#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const DEFAULT_WDA_REPO = "https://github.com/appium/WebDriverAgent.git";
const DEFAULT_WDA_REF = "v9.15.3";
const DEFAULT_WDA_PORT = 8100;

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function ivistaHome() {
  return expandHome(process.env.IVISTA_HOME || "~/.ivista");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeRef(ref) {
  return String(ref).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function wdaConfig(args = {}) {
  const repo = args.repo || process.env.IVISTA_WDA_REPO || DEFAULT_WDA_REPO;
  const ref = args.ref || process.env.IVISTA_WDA_REF || DEFAULT_WDA_REF;
  const home = ivistaHome();
  const cacheRoot = path.join(home, "cache", "webdriveragent");
  const cachePath = args.wdaPath
    ? path.resolve(expandHome(args.wdaPath))
    : path.join(cacheRoot, sanitizeRef(ref));
  return { repo, ref, home, cacheRoot, cachePath };
}

function sessionDir() {
  const dir = path.join(ivistaHome(), "sessions");
  ensureDir(dir);
  return dir;
}

function sessionFile(targetId = "default") {
  return path.join(sessionDir(), `${String(targetId).replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}

function writeSession(targetId, data) {
  fs.writeFileSync(sessionFile(targetId), JSON.stringify(data, null, 2));
}

function readSession(targetId = "default") {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(targetId), "utf8"));
  } catch {
    return {};
  }
}

function runCommand(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || pluginRoot,
      env: { ...process.env, ...(options.env || {}) },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        ok: false,
        code: null,
        signal: "SIGTERM",
        stdout,
        stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim(),
      });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (options.onStderr) options.onStderr(text);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, signal: null, stdout, stderr: error.message });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, signal, stdout, stderr });
    });
  });
}

function createGitProgressRenderer(label) {
  let lastBucket = -1;
  let lastStage = "";
  let lastText = "";
  let rendered = false;
  const writeLine = (text) => {
    rendered = true;
    lastText = text;
    readline.clearLine(process.stderr, 0);
    readline.cursorTo(process.stderr, 0);
    process.stderr.write(text);
  };
  const render = (stage, percent) => {
    const clamped = Math.max(0, Math.min(100, percent));
    const bucket = clamped === 100 ? 100 : Math.floor(clamped / 5) * 5;
    if (stage === lastStage && bucket === lastBucket) return;
    lastStage = stage;
    lastBucket = bucket;
    const width = 20;
    const filled = Math.round((bucket / 100) * width);
    const bar = `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
    writeLine(`${label}: ${stage} [${bar}] ${String(bucket).padStart(3)}%`);
  };
  return {
    update(chunk) {
      const text = chunk.replace(/\r/g, "\n");
      for (const line of text.split("\n")) {
        const match = line.match(/(Enumerating objects|Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files):\s+(\d+)%/);
        if (match) {
          render(match[1], Number(match[2]));
        }
      }
    },
    done() {
      if (!rendered) writeLine(`${label}: done`);
      if (lastText) process.stderr.write("\n");
    },
  };
}

function spawnDetached(command, args = [], options = {}) {
  ensureDir(options.logDir || path.join(ivistaHome(), "logs"));
  const logPath = options.logPath || path.join(options.logDir || path.join(ivistaHome(), "logs"), `${Date.now()}.log`);
  const out = fs.openSync(logPath, "a");
  const child = spawn(command, args, {
    cwd: options.cwd || pluginRoot,
    env: { ...process.env, ...(options.env || {}) },
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  return { pid: child.pid, logPath };
}

function jsonText(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function doctorHint(name) {
  if (name === "xcodebuild") {
    return {
      hint: "Xcode command line tools are not available or xcode-select points to the wrong developer directory.",
      commands: [
        "xcode-select -p",
        "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
        "xcodebuild -version",
      ],
    };
  }
  if (name === "simctl") {
    return {
      hint: "Simulator tools are not available. This is usually caused by a broken Xcode selection.",
      commands: [
        "xcrun simctl list devices",
        "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
      ],
    };
  }
  if (name === "git") {
    return {
      hint: "Git is required so iVista can download and cache WebDriverAgent.",
      commands: [
        "git --version",
        "xcode-select --install",
      ],
    };
  }
  return {
    hint: "Check that this command is installed and available in PATH.",
    commands: [],
  };
}

async function httpJson(method, url, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        headers: payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
            }
          : {},
        timeout: timeoutMs,
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk.toString();
        });
        response.on("end", () => {
          let data = raw;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            // Keep raw text when WDA returns non-JSON output.
          }
          resolve({ statusCode: response.statusCode, data });
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error(`HTTP timeout after ${timeoutMs}ms`));
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function wdaBaseUrl(args = {}) {
  const port = Number(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  return args.baseUrl || process.env.IVISTA_WDA_BASE_URL || `http://127.0.0.1:${port}`;
}

function extractSessionId(data) {
  return (
    data?.sessionId ||
    data?.value?.sessionId ||
    data?.value?.session_id ||
    data?.value?.capabilities?.sessionId ||
    null
  );
}

async function ensureWdaSession(args = {}) {
  const targetId = args.targetId || args.simulator || args.udid || "default";
  const saved = readSession(targetId);
  if (saved.sessionId) return saved.sessionId;
  const baseUrl = wdaBaseUrl(args);
  const response = await httpJson("POST", `${baseUrl}/session`, {
    capabilities: { alwaysMatch: {} },
    desiredCapabilities: {},
  });
  const sessionId = extractSessionId(response.data);
  if (!sessionId) {
    throw new Error(`Unable to create WDA session: ${JSON.stringify(response.data)}`);
  }
  writeSession(targetId, { ...saved, baseUrl, sessionId, updatedAt: new Date().toISOString() });
  return sessionId;
}

async function callWda(args, method, paths, body) {
  const baseUrl = wdaBaseUrl(args);
  const sessionId = paths.some((item) => item.includes(":sessionId"))
    ? await ensureWdaSession(args)
    : null;
  const errors = [];
  for (const template of paths) {
    const route = template.replace(":sessionId", sessionId);
    try {
      const response = await httpJson(method, `${baseUrl}${route}`, body, args.timeoutMs || 10000);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response;
      }
      errors.push({ route, statusCode: response.statusCode, data: response.data });
    } catch (error) {
      errors.push({ route, error: error.message });
    }
  }
  throw new Error(`All WDA routes failed: ${JSON.stringify(errors, null, 2)}`);
}

async function toolDoctor(args = {}) {
  const checks = [];
  for (const [name, command, commandArgs] of [
    ["xcodebuild", "xcodebuild", ["-version"]],
    ["simctl", "xcrun", ["simctl", "help"]],
    ["git", "git", ["--version"]],
  ]) {
    const result = await runCommand(command, commandArgs, { timeoutMs: args.timeoutMs || 10000 });
    checks.push({
      name,
      ok: result.ok,
      stdout: result.stdout.trim().split("\n").slice(0, 3).join("\n"),
      stderr: result.stderr.trim().split("\n").slice(0, 3).join("\n"),
      ...(result.ok ? {} : doctorHint(name)),
    });
  }
  const failedChecks = checks.filter((check) => !check.ok);
  return jsonText({
    ok: checks.every((check) => check.ok),
    ivistaHome: ivistaHome(),
    wda: wdaConfig(args),
    checks,
    hints: failedChecks.map((check) => ({
      name: check.name,
      hint: check.hint,
      commands: check.commands || [],
    })),
  });
}

async function toolSimulatorList(args = {}) {
  const result = await runCommand("xcrun", ["simctl", "list", "devices", "available", "--json"], {
    timeoutMs: args.timeoutMs || 15000,
  });
  if (!result.ok) return jsonText({ ok: false, error: result.stderr || result.stdout });
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    return jsonText({ ok: false, error: "Unable to parse simctl JSON", raw: result.stdout });
  }
  let devices = [];
  for (const [runtime, runtimeDevices] of Object.entries(data.devices || {})) {
    for (const device of runtimeDevices) {
      devices.push({
        runtime,
        name: device.name,
        udid: device.udid,
        state: device.state,
        isAvailable: device.isAvailable,
      });
    }
  }
  const total = devices.length;
  if (args.booted) devices = devices.filter((device) => device.state === "Booted");
  if (args.iphone) devices = devices.filter((device) => /^iPhone\b/.test(device.name));
  if (args.ipad) devices = devices.filter((device) => /^iPad\b/.test(device.name));
  if (!args.all) {
    const seen = new Set();
    devices = devices.filter((device) => {
      if (seen.has(device.name)) return false;
      seen.add(device.name);
      return true;
    });
  }
  return jsonText({ ok: true, devices, total, filtered: devices.length, compact: !args.all });
}

async function resolveSimulator(input) {
  if (!input) return null;
  const result = await runCommand("xcrun", ["simctl", "list", "devices", "available", "--json"], {
    timeoutMs: 15000,
  });
  if (!result.ok) throw new Error(result.stderr || result.stdout);
  const data = JSON.parse(result.stdout);
  for (const runtimeDevices of Object.values(data.devices || {})) {
    for (const device of runtimeDevices) {
      if (device.udid === input || device.name === input) return device;
    }
  }
  return null;
}

async function toolSimulatorBoot(args = {}) {
  const target = args.simulator || args.name || args.udid;
  if (!target) throw new Error("Provide simulator, name, or udid.");
  const device = await resolveSimulator(target);
  if (!device) throw new Error(`Simulator not found: ${target}`);
  if (device.state !== "Booted") {
    const boot = await runCommand("xcrun", ["simctl", "boot", device.udid], {
      timeoutMs: args.timeoutMs || 60000,
    });
    if (!boot.ok && !/Unable to boot device in current state: Booted/i.test(boot.stderr)) {
      return jsonText({ ok: false, device, error: boot.stderr || boot.stdout });
    }
  }
  const bootstatus = await runCommand("xcrun", ["simctl", "bootstatus", device.udid, "-b"], {
    timeoutMs: args.timeoutMs || 120000,
  });
  return jsonText({
    ok: bootstatus.ok,
    device: { ...device, state: "Booted" },
    stdout: bootstatus.stdout.trim(),
    stderr: bootstatus.stderr.trim(),
  });
}

async function toolWdaPrepare(args = {}) {
  const cfg = wdaConfig(args);
  ensureDir(cfg.cacheRoot);
  const exists = fs.existsSync(path.join(cfg.cachePath, "WebDriverAgent.xcodeproj"));
  if (!exists && args.wdaPath) {
    return jsonText({ ok: false, error: `WDA project not found at ${cfg.cachePath}` });
  }
  if (!exists) {
    const progress = args.progress ? createGitProgressRenderer("Downloading WDA") : null;
    if (args.progress) process.stderr.write(`Downloading WDA ${cfg.ref}\n`);
    const clone = await runCommand("git", ["clone", "--progress", "--depth", "1", "--branch", cfg.ref, cfg.repo, cfg.cachePath], {
      timeoutMs: args.timeoutMs || 300000,
      onStderr: progress ? (chunk) => progress.update(chunk) : undefined,
    });
    if (progress) progress.done();
    if (!clone.ok) return jsonText({ ok: false, config: cfg, error: clone.stderr || clone.stdout });
  }
  const metadata = {
    repo: cfg.repo,
    ref: cfg.ref,
    path: cfg.cachePath,
    preparedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(cfg.cachePath, ".ivista-cache.json"), JSON.stringify(metadata, null, 2));
  return jsonText({ ok: true, ...metadata });
}

async function toolWdaCacheStatus(args = {}) {
  const cfg = wdaConfig(args);
  const exists = fs.existsSync(path.join(cfg.cachePath, "WebDriverAgent.xcodeproj"));
  let metadata = null;
  try {
    metadata = JSON.parse(fs.readFileSync(path.join(cfg.cachePath, ".ivista-cache.json"), "utf8"));
  } catch {
    metadata = null;
  }
  return jsonText({ ok: true, exists, config: cfg, metadata });
}

async function toolWdaStartSimulator(args = {}) {
  const target = args.simulator || args.name || args.udid;
  if (!target) throw new Error("Provide simulator, name, or udid.");
  const device = await resolveSimulator(target);
  if (!device) throw new Error(`Simulator not found: ${target}`);
  if (device.state !== "Booted") {
    const bootResult = await toolSimulatorBoot({ ...args, simulator: device.udid });
    const bootText = bootResult.content[0].text;
    const bootJson = JSON.parse(bootText);
    if (!bootJson.ok) return bootResult;
  }
  const prepared = await toolWdaPrepare(args);
  const preparedJson = JSON.parse(prepared.content[0].text);
  if (!preparedJson.ok) return prepared;

  const port = String(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  const logDir = path.join(ivistaHome(), "logs");
  ensureDir(logDir);
  const logPath = path.join(logDir, `wda-simulator-${device.udid}-${Date.now()}.log`);
  const destination = `platform=iOS Simulator,id=${device.udid}`;
  const xcodeArgs = [
    "test",
    "-project",
    path.join(preparedJson.path, "WebDriverAgent.xcodeproj"),
    "-scheme",
    "WebDriverAgentRunner",
    "-destination",
    destination,
    "USE_PORT=" + port,
  ];
  const spawned = spawnDetached("xcodebuild", xcodeArgs, { cwd: preparedJson.path, logDir, logPath });
  const baseUrl = `http://127.0.0.1:${port}`;
  writeSession(device.udid, {
    targetType: "simulator",
    simulator: device,
    baseUrl,
    pid: spawned.pid,
    logPath: spawned.logPath,
    startedAt: new Date().toISOString(),
  });

  const deadline = Date.now() + (args.waitMs || 90000);
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const status = await httpJson("GET", `${baseUrl}/status`, undefined, 3000);
      if (status.statusCode >= 200 && status.statusCode < 300) {
        return jsonText({
          ok: true,
          baseUrl,
          pid: spawned.pid,
          logPath: spawned.logPath,
          status: status.data,
        });
      }
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return jsonText({
    ok: false,
    baseUrl,
    pid: spawned.pid,
    logPath: spawned.logPath,
    error: lastError || "Timed out waiting for WDA /status.",
  });
}

async function toolWdaStatus(args = {}) {
  const baseUrl = wdaBaseUrl(args);
  const response = await httpJson("GET", `${baseUrl}/status`, undefined, args.timeoutMs || 10000);
  return jsonText({ ok: response.statusCode >= 200 && response.statusCode < 300, baseUrl, response });
}

async function toolScreenshot(args = {}) {
  const response = await callWda(args, "GET", ["/screenshot", "/session/:sessionId/screenshot"]);
  return jsonText({ ok: true, response: response.data });
}

async function toolSource(args = {}) {
  const response = await callWda(args, "GET", ["/source", "/session/:sessionId/source"]);
  return jsonText({ ok: true, response: response.data });
}

async function toolTap(args = {}) {
  const x = Number(args.x);
  const y = Number(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Provide numeric x and y.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/tap", "/wda/tap"], { x, y });
  return jsonText({ ok: true, response: response.data });
}

async function toolInput(args = {}) {
  if (typeof args.text !== "string") throw new Error("Provide text.");
  const body = { value: [...args.text], text: args.text };
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/keys", "/session/:sessionId/keys", "/wda/keys"], body);
  return jsonText({ ok: true, response: response.data });
}

function swipePoints(args = {}) {
  if (["up", "down", "left", "right"].includes(args.direction)) {
    const width = Number(args.width || 390);
    const height = Number(args.height || 844);
    const midX = Math.round(width / 2);
    const midY = Math.round(height / 2);
    const spanX = Math.round(width * 0.35);
    const spanY = Math.round(height * 0.35);
    if (args.direction === "up") return { fromX: midX, fromY: midY + spanY, toX: midX, toY: midY - spanY };
    if (args.direction === "down") return { fromX: midX, fromY: midY - spanY, toX: midX, toY: midY + spanY };
    if (args.direction === "left") return { fromX: midX + spanX, fromY: midY, toX: midX - spanX, toY: midY };
    return { fromX: midX - spanX, fromY: midY, toX: midX + spanX, toY: midY };
  }
  return {
    fromX: Number(args.fromX),
    fromY: Number(args.fromY),
    toX: Number(args.toX),
    toY: Number(args.toY),
  };
}

async function toolSwipe(args = {}) {
  const points = swipePoints(args);
  for (const [key, value] of Object.entries(points)) {
    if (!Number.isFinite(value)) throw new Error(`Provide numeric ${key}, or use direction.`);
  }
  const body = { ...points, duration: Number(args.duration || 0.25) };
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/dragfromtoforduration"], body);
  return jsonText({ ok: true, response: response.data });
}

async function toolLaunchApp(args = {}) {
  if (!args.bundleId) throw new Error("Provide bundleId.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/apps/launch"], {
    bundleId: args.bundleId,
    arguments: args.arguments || [],
    environment: args.environment || {},
  });
  return jsonText({ ok: true, response: response.data });
}

async function toolTerminateApp(args = {}) {
  if (!args.bundleId) throw new Error("Provide bundleId.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/apps/terminate"], {
    bundleId: args.bundleId,
  });
  return jsonText({ ok: true, response: response.data });
}

export const tools = {
  ivista_doctor: {
    description: "Check local Xcode, simctl, git, iVista cache, and WDA configuration.",
    inputSchema: {
      type: "object",
      properties: {
        timeoutMs: { type: "number" },
        repo: { type: "string" },
        ref: { type: "string" },
      },
    },
    handler: toolDoctor,
  },
  ivista_simulator_list: {
    description: "List available iOS Simulators using simctl.",
    inputSchema: {
      type: "object",
      properties: {
        timeoutMs: { type: "number" },
        all: { type: "boolean" },
        booted: { type: "boolean" },
        iphone: { type: "boolean" },
        ipad: { type: "boolean" },
      },
    },
    handler: toolSimulatorList,
  },
  ivista_simulator_boot: {
    description: "Boot an iOS Simulator by name or UDID.",
    inputSchema: {
      type: "object",
      properties: {
        simulator: { type: "string" },
        name: { type: "string" },
        udid: { type: "string" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolSimulatorBoot,
  },
  ivista_wda_cache_status: {
    description: "Inspect the local cached WebDriverAgent project.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        ref: { type: "string" },
        wdaPath: { type: "string" },
      },
    },
    handler: toolWdaCacheStatus,
  },
  ivista_wda_prepare: {
    description: "Download and cache the pinned WebDriverAgent project if missing.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        ref: { type: "string" },
        wdaPath: { type: "string" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaPrepare,
  },
  ivista_wda_start_simulator: {
    description: "Boot a Simulator if needed, prepare cached WDA, start WebDriverAgent, and wait for /status.",
    inputSchema: {
      type: "object",
      required: ["simulator"],
      properties: {
        simulator: { type: "string" },
        repo: { type: "string" },
        ref: { type: "string" },
        wdaPath: { type: "string" },
        port: { type: "number" },
        waitMs: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaStartSimulator,
  },
  ivista_wda_status: {
    description: "Read WDA /status from the configured base URL.",
    inputSchema: {
      type: "object",
      properties: {
        baseUrl: { type: "string" },
        port: { type: "number" },
        timeoutMs: { type: "number" },
      },
    },
    handler: toolWdaStatus,
  },
  ivista_screenshot: {
    description: "Take a WDA screenshot. Returns the WDA JSON response, usually with base64 image data.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolScreenshot,
  },
  ivista_source: {
    description: "Read the current WDA source/accessibility tree.",
    inputSchema: { type: "object", properties: { baseUrl: { type: "string" }, port: { type: "number" } } },
    handler: toolSource,
  },
  ivista_tap: {
    description: "Tap screen coordinates through WDA.",
    inputSchema: {
      type: "object",
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolTap,
  },
  ivista_input: {
    description: "Type text through WDA.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolInput,
  },
  ivista_swipe: {
    description: "Swipe through WDA using a direction or explicit coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "left", "right"] },
        width: { type: "number" },
        height: { type: "number" },
        fromX: { type: "number" },
        fromY: { type: "number" },
        toX: { type: "number" },
        toY: { type: "number" },
        duration: { type: "number" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolSwipe,
  },
  ivista_launch_app: {
    description: "Launch an app by bundle id through WDA.",
    inputSchema: {
      type: "object",
      required: ["bundleId"],
      properties: {
        bundleId: { type: "string" },
        arguments: { type: "array", items: { type: "string" } },
        environment: { type: "object" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolLaunchApp,
  },
  ivista_terminate_app: {
    description: "Terminate an app by bundle id through WDA.",
    inputSchema: {
      type: "object",
      required: ["bundleId"],
      properties: {
        bundleId: { type: "string" },
        baseUrl: { type: "string" },
        port: { type: "number" },
      },
    },
    handler: toolTerminateApp,
  },
};

export function listTools() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callTool(name, args = {}) {
  const tool = tools[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return await tool.handler(args);
}
