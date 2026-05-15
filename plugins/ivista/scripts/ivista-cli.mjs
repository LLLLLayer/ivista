#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mcpServerPath = path.join(scriptDir, "ivista-mcp.mjs");

const commandMap = new Map([
  ["doctor", "ivista_doctor"],
  ["simulator list", "ivista_simulator_list"],
  ["simulator boot", "ivista_simulator_boot"],
  ["wda cache status", "ivista_wda_cache_status"],
  ["wda prepare", "ivista_wda_prepare"],
  ["wda start", "ivista_wda_start_simulator"],
  ["wda status", "ivista_wda_status"],
  ["screen shot", "ivista_screenshot"],
  ["screen source", "ivista_source"],
  ["act tap", "ivista_tap"],
  ["act input", "ivista_input"],
  ["act swipe", "ivista_swipe"],
  ["app launch", "ivista_launch_app"],
  ["app terminate", "ivista_terminate_app"],
]);

function printHelp() {
  console.log(`iVista CLI 0.1.1

Usage:
  ivista doctor [--json]
  ivista simulator list [--json]
  ivista simulator boot --name "iPhone 16"
  ivista wda prepare [--ref v9.15.3]
  ivista wda start --simulator "iPhone 16" [--port 8100]
  ivista wda status [--port 8100]
  ivista screen shot [--port 8100]
  ivista screen source [--port 8100]
  ivista act tap --x 120 --y 500
  ivista act input "hello"
  ivista act swipe --direction up
  ivista app launch --bundle-id com.example.app
  ivista app terminate --bundle-id com.example.app

Options:
  --json                  Print raw JSON output.
  --simulator <name|udid> Simulator name or UDID.
  --name <name>           Simulator name.
  --udid <udid>           Device or Simulator UDID.
  --bundle-id <id>        App bundle id.
  --base-url <url>        WDA base URL.
  --port <port>           WDA port. Defaults to 8100.
  --wda-path <path>       Use an explicit WDA project path.
  --repo <url>            WDA git repository.
  --ref <ref>             WDA git ref. Defaults to v9.15.3.
  --timeout <ms>          Command timeout in milliseconds.
  --wait <ms>             WDA startup wait timeout in milliseconds.
`);
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === "json" || key === "help") {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    index += 1;
  }
  return { positionals, options };
}

function normalizeOptions(options, positionals) {
  const out = {};
  const aliases = {
    "bundle-id": "bundleId",
    "base-url": "baseUrl",
    "wda-path": "wdaPath",
  };
  for (const [key, value] of Object.entries(options)) {
    const normalized = aliases[key] || key;
    out[normalized] = value;
  }
  for (const key of ["port", "timeout", "wait", "x", "y", "width", "height", "fromX", "fromY", "toX", "toY", "duration"]) {
    if (out[key] !== undefined) out[key] = Number(out[key]);
  }
  if (out.timeout !== undefined) {
    out.timeoutMs = out.timeout;
    delete out.timeout;
  }
  if (out.wait !== undefined) {
    out.waitMs = out.wait;
    delete out.wait;
  }
  if (positionals[0] === "act" && positionals[1] === "input" && typeof out.text !== "string") {
    out.text = positionals.slice(2).join(" ");
  }
  return out;
}

function resolveCommand(positionals) {
  const candidates = [
    positionals.slice(0, 3).join(" "),
    positionals.slice(0, 2).join(" "),
    positionals.slice(0, 1).join(" "),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (commandMap.has(candidate)) return { key: candidate, tool: commandMap.get(candidate) };
  }
  return null;
}

function send(child, payload) {
  const body = JSON.stringify(payload);
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function createReader(child) {
  let buffer = Buffer.alloc(0);
  return function readOne(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      child.stdout.on("data", function onData(chunk) {
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const header = buffer.slice(0, headerEnd).toString("utf8");
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) return;
        const length = Number(match[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + length;
        if (buffer.length < bodyEnd) return;
        const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
        buffer = buffer.slice(bodyEnd);
        child.stdout.off("data", onData);
        clearTimeout(timer);
        resolve(JSON.parse(body));
      });
    });
  };
}

async function callTool(tool, args, timeoutMs) {
  const child = spawn("node", [mcpServerPath], {
    cwd: path.resolve(scriptDir, ".."),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const readOne = createReader(child);
  try {
    send(child, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    const init = await readOne(timeoutMs);
    if (init.error) throw new Error(init.error.message);
    send(child, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } });
    const response = await readOne(timeoutMs);
    if (response.error) throw new Error(response.error.message);
    return response.result;
  } finally {
    child.kill("SIGTERM");
    if (stderr.trim() && process.env.IVISTA_DEBUG) process.stderr.write(stderr);
  }
}

function extractJson(result) {
  const text = result?.content?.find((item) => item.type === "text")?.text || "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function printResult(result, rawJson) {
  const payload = extractJson(result);
  if (rawJson || typeof payload !== "object") {
    console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  if (options.help || positionals.length === 0) {
    printHelp();
    return;
  }
  const command = resolveCommand(positionals);
  if (!command) {
    console.error(`Unknown command: ${positionals.join(" ")}`);
    printHelp();
    process.exit(2);
  }
  const args = normalizeOptions(options, positionals);
  delete args.json;
  delete args.help;
  const timeoutMs = args.timeoutMs || 30000;
  const result = await callTool(command.tool, args, timeoutMs);
  printResult(result, Boolean(options.json));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
