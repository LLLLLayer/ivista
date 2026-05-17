import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { ensureDir, expandHome, ivistaHome, jsonText } from "./core.mjs";

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return nowIso().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function safePart(value, fallback = "default") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function execGit(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function runsRoot() {
  return path.join(ivistaHome(), "projects");
}

export function currentRunFile() {
  return path.join(ivistaHome(), "current-run.json");
}

export function inferProject(inputProject) {
  const requested = inputProject || process.env.IVISTA_PROJECT || process.env.IVISTA_PROJECT_ROOT || process.cwd();
  const cwd = path.resolve(expandHome(requested));
  const gitRoot = execGit(["rev-parse", "--show-toplevel"], cwd);
  const root = gitRoot || cwd;
  const remote = execGit(["config", "--get", "remote.origin.url"], root);
  const branch = execGit(["rev-parse", "--abbrev-ref", "HEAD"], root);
  const name = path.basename(root);
  const projectKey = `${safePart(name)}-${hash(remote || root)}`;
  return { projectKey, name, root, gitRemote: remote || null, branch: branch || null };
}

export function projectDir(projectKey) {
  return path.join(runsRoot(), projectKey);
}

export function conversationDir(projectKey, conversationId) {
  return path.join(projectDir(projectKey), "conversations", conversationId);
}

export function runDir(projectKey, conversationId, runId) {
  return path.join(conversationDir(projectKey, conversationId), "runs", runId);
}

export function ensureProject(project) {
  const dir = projectDir(project.projectKey);
  const file = path.join(dir, "project.json");
  const existing = readJson(file, {});
  const data = {
    ...existing,
    ...project,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  writeJson(file, data);
  return { ...data, dir };
}

export function ensureConversation(project, conversationId, args = {}) {
  const id = safePart(conversationId, `conversation-${stamp()}`);
  const dir = conversationDir(project.projectKey, id);
  const file = path.join(dir, "conversation.json");
  const existing = readJson(file, {});
  const data = {
    ...existing,
    conversationId: id,
    title: args.title || existing.title || null,
    projectKey: project.projectKey,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  writeJson(file, data);
  return { ...data, dir };
}

export function ensureRun(project, conversation, runId, args = {}) {
  const id = safePart(runId, `run-${stamp()}`);
  const dir = runDir(project.projectKey, conversation.conversationId, id);
  const artifactDir = path.join(dir, "artifacts");
  ensureDir(artifactDir);
  const file = path.join(dir, "run.json");
  const existing = readJson(file, {});
  const data = {
    ...existing,
    runId: id,
    projectKey: project.projectKey,
    conversationId: conversation.conversationId,
    title: args.title || existing.title || null,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
    artifactDir,
    eventsPath: path.join(dir, "events.ndjson"),
  };
  writeJson(file, data);
  writeJson(currentRunFile(), {
    projectKey: project.projectKey,
    conversationId: conversation.conversationId,
    runId: id,
    projectRoot: project.root,
    runDir: dir,
    updatedAt: nowIso(),
  });
  return { ...data, dir };
}

export function startRun(args = {}) {
  const project = ensureProject(inferProject(args.project));
  const conversationId = args.conversation
    || process.env.IVISTA_CONVERSATION_ID
    || process.env.CODEX_CONVERSATION_ID
    || process.env.CODEX_THREAD_ID
    || `conversation-${stamp()}`;
  const conversation = ensureConversation(project, conversationId, args);
  const runId = args.run || process.env.IVISTA_RUN_ID || `run-${stamp()}`;
  const run = ensureRun(project, conversation, runId, args);
  return { ok: true, project, conversation, run };
}

export function currentRun({ create = false, args = {} } = {}) {
  const current = readJson(currentRunFile(), null);
  if (current?.projectKey && current?.conversationId && current?.runId) {
    const project = readJson(path.join(projectDir(current.projectKey), "project.json"), null);
    const conversation = readJson(path.join(conversationDir(current.projectKey, current.conversationId), "conversation.json"), null);
    const run = readJson(path.join(runDir(current.projectKey, current.conversationId, current.runId), "run.json"), null);
    if (project && conversation && run) {
      return {
        ok: true,
        project: { ...project, dir: projectDir(project.projectKey) },
        conversation: { ...conversation, dir: conversationDir(project.projectKey, conversation.conversationId) },
        run: { ...run, dir: runDir(project.projectKey, conversation.conversationId, run.runId) },
      };
    }
  }
  return create ? startRun(args) : { ok: false, error: "No current iVista run. Start one with `ivista run start`." };
}

function nextArtifactIndex(artifactDir) {
  ensureDir(artifactDir);
  const max = fs.readdirSync(artifactDir)
    .map((name) => Number((name.match(/^(\d+)-/) || [])[1]))
    .filter(Number.isFinite)
    .reduce((highest, value) => Math.max(highest, value), 0);
  return max + 1;
}

export function saveRunArtifact(args = {}, kind, extension, data) {
  const ctx = currentRun({ create: true, args });
  if (!ctx.ok) return null;
  const index = nextArtifactIndex(ctx.run.artifactDir);
  const filename = `${String(index).padStart(4, "0")}-${safePart(kind)}.${extension}`;
  const file = path.join(ctx.run.artifactDir, filename);
  fs.writeFileSync(file, data);
  const artifact = {
    kind,
    path: file,
    relativePath: path.relative(ctx.run.dir, file),
    createdAt: nowIso(),
  };
  appendRunEvent("artifact", { kind, artifact }, ctx);
  return artifact;
}

export function summarizeResult(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const summary = { ok: payload.ok };
  for (const key of ["output", "artifact", "artifacts", "selector", "method", "point", "match", "error", "hints", "baseUrl", "port"]) {
    if (payload[key] !== undefined) summary[key] = payload[key];
  }
  if (typeof payload.response?.value === "string") {
    summary.response = { valueBytes: payload.response.value.length };
  }
  return summary;
}

export function appendRunEvent(type, data = {}, context = null) {
  const ctx = context || currentRun({ create: true, args: {} });
  if (!ctx.ok) return null;
  const event = {
    ts: nowIso(),
    type,
    projectKey: ctx.project.projectKey,
    conversationId: ctx.conversation.conversationId,
    runId: ctx.run.runId,
    ...data,
  };
  ensureDir(path.dirname(ctx.run.eventsPath));
  fs.appendFileSync(ctx.run.eventsPath, `${JSON.stringify(event)}\n`);
  const run = readJson(path.join(ctx.run.dir, "run.json"), {});
  writeJson(path.join(ctx.run.dir, "run.json"), { ...run, updatedAt: nowIso() });
  writeJson(currentRunFile(), {
    projectKey: ctx.project.projectKey,
    conversationId: ctx.conversation.conversationId,
    runId: ctx.run.runId,
    projectRoot: ctx.project.root,
    runDir: ctx.run.dir,
    updatedAt: nowIso(),
  });
  return event;
}

export async function toolRunStart(args = {}) {
  return jsonText(startRun(args));
}

export async function toolRunCurrent(args = {}) {
  return jsonText(currentRun({ create: Boolean(args.create), args }));
}
