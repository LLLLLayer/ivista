import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

export const DEFAULT_WDA_REPO = "https://github.com/LLLLLayer/ivista-wda.git";
export const DEFAULT_WDA_REF = "ivista-wda-v1.0.0";
export const DEFAULT_WDA_PORT = 8100;

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function ivistaHome() {
  return expandHome(process.env.IVISTA_HOME || "~/.ivista");
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function sanitizeRef(ref) {
  return String(ref).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function wdaConfig(args = {}) {
  const repo = args.repo || process.env.IVISTA_WDA_REPO || DEFAULT_WDA_REPO;
  const ref = args.ref || process.env.IVISTA_WDA_REF || DEFAULT_WDA_REF;
  const home = ivistaHome();
  const cacheRoot = path.join(home, "cache", "webdriveragent");
  const cachePath = args.wdaPath
    ? path.resolve(expandHome(args.wdaPath))
    : path.join(cacheRoot, sanitizeRef(ref));
  return { repo, ref, home, cacheRoot, cachePath };
}

export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

export async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + 99}`);
}

export function runCommand(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || projectRoot,
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

export function createGitProgressRenderer(label) {
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

export function spawnDetached(command, args = [], options = {}) {
  ensureDir(options.logDir || path.join(ivistaHome(), "logs"));
  const logPath = options.logPath || path.join(options.logDir || path.join(ivistaHome(), "logs"), `${Date.now()}.log`);
  const out = fs.openSync(logPath, "a");
  const child = spawn(command, args, {
    cwd: options.cwd || projectRoot,
    env: { ...process.env, ...(options.env || {}) },
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  return { pid: child.pid, logPath };
}

export async function commandExists(command) {
  const result = await runCommand("which", [command], { timeoutMs: 5000 });
  return result.ok;
}

export function jsonText(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export async function httpJson(method, url, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const hostname = parsed.hostname.replace(/^\[(.*)\]$/, "$1");
    const request = http.request(
      {
        method,
        hostname,
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

export function wdaBaseUrl(args = {}) {
  const port = Number(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  return args.baseUrl || process.env.IVISTA_WDA_BASE_URL || `http://127.0.0.1:${port}`;
}
