import fs from "node:fs";
import path from "node:path";

import { ensureDir, httpJson, ivistaHome, wdaBaseUrl } from "./core.mjs";

export function sessionDir() {
  const dir = path.join(ivistaHome(), "sessions");
  ensureDir(dir);
  return dir;
}

export function sessionFile(targetId = "default") {
  return path.join(sessionDir(), `${String(targetId).replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
}

export function writeSession(targetId, data) {
  fs.writeFileSync(sessionFile(targetId), JSON.stringify(data, null, 2));
}

export function readSession(targetId = "default") {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(targetId), "utf8"));
  } catch {
    return {};
  }
}

export function sessionPort(data) {
  if (data?.port) return Number(data.port);
  try {
    return Number(new URL(data?.baseUrl || "http://127.0.0.1:0").port);
  } catch {
    return 0;
  }
}

export function listSessions() {
  try {
    return fs.readdirSync(sessionDir())
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const file = path.join(sessionDir(), name);
        try {
          return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
        } catch {
          return { file, data: null };
        }
      })
      .filter((item) => item.data);
  } catch {
    return [];
  }
}

export function removeSessionFile(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    // Ignore stale session cleanup errors.
  }
}

export function removeSession(targetId = "default") {
  removeSessionFile(sessionFile(targetId));
}

export function sessionFileTargetId(file) {
  return path.basename(file, ".json");
}

export function resolveSessionTargetId(args = {}, baseUrl = wdaBaseUrl(args)) {
  if (args.targetId) return args.targetId;
  if (args.simulator) return args.simulator;
  if (args.device) return args.device;
  if (args.udid) return args.udid;
  if (args.name) return args.name;

  const wantedPort = sessionPort({ baseUrl });
  const matches = listSessions().filter(({ data }) => {
    if (wantedPort && sessionPort(data) !== wantedPort) return false;
    return data.baseUrl === baseUrl || data.port === wantedPort || data.targetType === "simulator";
  });
  if (matches.length === 1) {
    const { file, data } = matches[0];
    return data.simulator?.udid || data.device?.udid || data.simulator?.name || data.device?.name || sessionFileTargetId(file);
  }

  const simulatorMatch = matches.find(({ data }) => data.targetType === "simulator" && data.simulator?.udid);
  if (simulatorMatch) return simulatorMatch.data.simulator.udid;
  const deviceMatch = matches.find(({ data }) => data.targetType === "device" && data.device?.udid);
  if (deviceMatch) return deviceMatch.data.device.udid;

  return "default";
}

export function resolveWdaBaseUrl(args = {}) {
  if (args.baseUrl || process.env.IVISTA_WDA_BASE_URL) return wdaBaseUrl(args);
  const fallback = wdaBaseUrl(args);
  const wantedPort = sessionPort({ baseUrl: fallback });
  if (!wantedPort) return fallback;
  const matches = listSessions().filter(({ data }) => sessionPort(data) === wantedPort);
  if (matches.length === 1 && matches[0].data.baseUrl) return matches[0].data.baseUrl;
  return fallback;
}

export function extractSessionId(data) {
  return (
    data?.sessionId ||
    data?.value?.sessionId ||
    data?.value?.session_id ||
    data?.value?.capabilities?.sessionId ||
    null
  );
}

export function isInvalidSessionResponse(response) {
  const value = response?.data?.value || {};
  const error = String(value.error || response?.data?.error || "").toLowerCase();
  const message = String(value.message || response?.data?.message || "").toLowerCase();
  return response?.statusCode === 404 && (error.includes("invalid session") || message.includes("session does not exist"));
}

export async function ensureWdaSession(args = {}) {
  const baseUrl = resolveWdaBaseUrl(args);
  const targetId = resolveSessionTargetId(args, baseUrl);
  const saved = readSession(targetId);
  if (saved.sessionId && !args.forceNewSession) return { targetId, sessionId: saved.sessionId };
  const response = await httpJson("POST", `${baseUrl}/session`, {
    capabilities: { alwaysMatch: {} },
    desiredCapabilities: {},
  });
  const sessionId = extractSessionId(response.data);
  if (!sessionId) {
    throw new Error(`Unable to create WDA session: ${JSON.stringify(response.data)}`);
  }
  writeSession(targetId, { ...saved, baseUrl, sessionId, updatedAt: new Date().toISOString() });
  return { targetId, sessionId };
}

export async function callWda(args, method, paths, body) {
  const baseUrl = resolveWdaBaseUrl(args);
  const needsSession = paths.some((item) => item.includes(":sessionId"));
  let session = needsSession ? await ensureWdaSession(args) : null;
  const errors = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let sawInvalidSession = false;
    for (const template of paths) {
      const route = template.replace(":sessionId", session?.sessionId || "");
      try {
        const response = await httpJson(method, `${baseUrl}${route}`, body, args.timeoutMs || 10000);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return response;
        }
        sawInvalidSession ||= needsSession && isInvalidSessionResponse(response);
        errors.push({ route, statusCode: response.statusCode, data: response.data });
      } catch (error) {
        errors.push({ route, error: error.message });
      }
    }
    if (!sawInvalidSession || !needsSession || attempt > 0) break;
    removeSession(session.targetId);
    session = await ensureWdaSession({ ...args, forceNewSession: true, targetId: session.targetId });
    errors.push({ route: "/session", recovered: "stale WDA session was recreated" });
  }
  throw new Error(`All WDA routes failed: ${JSON.stringify(errors, null, 2)}`);
}
