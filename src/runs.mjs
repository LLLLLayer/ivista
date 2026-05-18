import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { ensureDir, expandHome, ivistaHome, jsonText } from "./core.mjs";
import { CLI_VERSION } from "./cli/constants.mjs";

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

function readNdjson(file) {
  try {
    return fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
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

function execTool(command, args, cwd = process.cwd()) {
  try {
    execFileSync(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
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

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function relativeLink(fromDir, file) {
  const relative = path.relative(fromDir, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return file.split(path.sep).join("/");
  }
  return relative.split(path.sep).join("/");
}

function eventDescription(event, reportDir) {
  if (event.type === "artifact") {
    const artifact = event.artifact;
    const link = artifact?.path ? `[${path.basename(artifact.path)}](${relativeLink(reportDir, artifact.path)})` : "";
    return `artifact ${event.kind}${link ? ` ${link}` : ""}`;
  }
  if (event.type === "command") {
    const pieces = [`command \`${event.command}\``];
    const artifact = event.result?.artifact;
    if (artifact?.path) pieces.push(`[artifact](${relativeLink(reportDir, artifact.path)})`);
    if (event.result?.output) pieces.push(`output \`${event.result.output}\``);
    if (event.result?.selector) pieces.push(`selector \`${selectorText(event.result.selector)}\``);
    if (event.result?.error) pieces.push(`error: ${event.result.error}`);
    return pieces.join(" ");
  }
  if (event.type === "export") {
    const link = event.output ? `[${path.basename(event.output)}](${relativeLink(reportDir, event.output)})` : "";
    return `export ${event.format || "run"}${link ? ` ${link}` : ""}`;
  }
  return event.type;
}

function artifactLink(reportDir, artifact) {
  if (!artifact?.path) return "";
  return `[${markdownEscape(path.basename(artifact.path))}](${relativeLink(reportDir, artifact.path)})`;
}

function commandStatus(event) {
  if (event.result?.ok === false) return "failed";
  if (event.result?.ok === true) return "ok";
  return "unknown";
}

function selectorText(selector) {
  if (!selector || typeof selector !== "object") return "";
  if (selector.mode && selector.text !== undefined) return `${selector.mode} "${selector.text}"`;
  return "";
}

function pointText(point) {
  if (!point || typeof point !== "object") return "";
  if (point.x === undefined || point.y === undefined) return "";
  return `point x=${point.x} y=${point.y}`;
}

function commandSummary(event, reportDir) {
  const result = event.result || {};
  const pieces = [];
  if (result.error) pieces.push(`error: ${result.error}`);
  if (result.method) pieces.push(`method: ${result.method}`);
  if (result.selector) pieces.push(`selector: ${selectorText(result.selector)}`);
  if (result.match?.summary) pieces.push(`match: ${result.match.summary}`);
  if (result.point) pieces.push(pointText(result.point));
  if (result.output) {
    const output = String(result.output);
    const label = path.basename(output) || output;
    pieces.push(`output: [${markdownEscape(label)}](${relativeLink(reportDir, output)})`);
  }
  if (result.artifact?.path) pieces.push(`artifact: ${artifactLink(reportDir, result.artifact)}`);
  if (result.baseUrl) pieces.push(`url: ${result.baseUrl}`);
  if (result.port) pieces.push(`port: ${result.port}`);
  if (result.hints?.length) pieces.push(`hint: ${result.hints[0]}`);
  return pieces.filter(Boolean).join("; ") || commandStatus(event);
}

function artifactKindCounts(events) {
  const counts = new Map();
  for (const event of events) {
    counts.set(event.kind, (counts.get(event.kind) || 0) + 1);
  }
  return [...counts.entries()].map(([kind, count]) => `${kind}: ${count}`).join(", ") || "none";
}

function readArtifactJson(artifact) {
  try {
    return JSON.parse(fs.readFileSync(artifact.path, "utf8"));
  } catch {
    return null;
  }
}

function screenshotPreviewLines(reportDir, artifactEvents) {
  const screenshots = artifactEvents.filter((event) => event.kind === "screenshot" && event.artifact?.path).slice(-6);
  if (screenshots.length === 0) return ["No screenshots captured.", ""];
  const lines = [];
  for (const event of screenshots) {
    const src = relativeLink(reportDir, event.artifact.path);
    lines.push(`### ${event.ts}`, "");
    lines.push(`![Screenshot ${event.ts}](${src})`, "");
  }
  return lines;
}

function textSnapshotLines(reportDir, artifactEvents) {
  const snapshots = artifactEvents.filter((event) => event.kind === "texts" && event.artifact?.path).slice(-5);
  if (snapshots.length === 0) return ["No text snapshots captured.", ""];
  const lines = ["| Time | File | Text Count | First Texts |", "| --- | --- | --- | --- |"];
  for (const event of snapshots) {
    const data = readArtifactJson(event.artifact) || {};
    const texts = Array.isArray(data.texts) ? data.texts : [];
    const preview = texts.slice(0, 8).join(", ");
    lines.push(`| ${markdownEscape(event.ts)} | ${artifactLink(reportDir, event.artifact)} | ${texts.length} | ${markdownEscape(preview)} |`);
  }
  lines.push("");
  return lines;
}

export function buildRunMarkdown(ctx, outputPath) {
  const reportDir = path.dirname(outputPath);
  const events = readNdjson(ctx.run.eventsPath);
  const artifactEvents = events.filter((event) => event.type === "artifact");
  const commandEvents = events.filter((event) => event.type === "command");
  const failedCommandEvents = commandEvents.filter((event) => event.result?.ok === false);
  const lines = [
    "# iVista Run Report",
    "",
    "## Summary",
    "",
    `- Generated: ${nowIso()}`,
    `- iVista CLI: ${CLI_VERSION}`,
    `- Project: ${ctx.project.name || ctx.project.projectKey}`,
    `- Project key: ${ctx.project.projectKey}`,
    `- Project root: ${ctx.project.root}`,
    `- Git remote: ${ctx.project.gitRemote || "n/a"}`,
    `- Branch: ${ctx.project.branch || "n/a"}`,
    `- Conversation: ${ctx.conversation.conversationId}`,
    `- Run: ${ctx.run.runId}`,
    `- Created: ${ctx.run.createdAt}`,
    `- Updated: ${ctx.run.updatedAt}`,
    `- Commands: ${commandEvents.length}`,
    `- Failed commands: ${failedCommandEvents.length}`,
    `- Artifacts: ${artifactEvents.length} (${artifactKindCounts(artifactEvents)})`,
    `- Run directory: ${ctx.run.dir}`,
    "",
    "## Artifacts",
    "",
  ];
  if (artifactEvents.length === 0) {
    lines.push("No artifacts captured.", "");
  } else {
    lines.push("| Time | Kind | File |", "| --- | --- | --- |");
    for (const event of artifactEvents) {
      const artifact = event.artifact || {};
      const link = artifactLink(reportDir, artifact);
      lines.push(`| ${markdownEscape(event.ts)} | ${markdownEscape(event.kind)} | ${link} |`);
    }
    lines.push("");
  }
  lines.push("## Screenshots", "", ...screenshotPreviewLines(reportDir, artifactEvents));
  lines.push("## Text Snapshots", "", ...textSnapshotLines(reportDir, artifactEvents));
  lines.push("## Failures", "");
  if (failedCommandEvents.length === 0) {
    lines.push("No failed commands recorded.", "");
  } else {
    for (const event of failedCommandEvents) {
      lines.push(`- ${event.ts} - \`${event.command}\`: ${event.result?.error || "failed"}`);
      for (const hint of event.result?.hints || []) lines.push(`  - hint: ${hint}`);
    }
    lines.push("");
  }
  lines.push("## Timeline", "");
  if (events.length === 0) {
    lines.push("No events recorded.", "");
  } else {
    for (const event of events) {
      lines.push(`- ${event.ts} - ${eventDescription(event, reportDir)}`);
    }
    lines.push("");
  }
  lines.push("## Command Summary", "");
  if (commandEvents.length === 0) {
    lines.push("No commands recorded.", "");
  } else {
    lines.push("| Time | Command | Status | Summary |", "| --- | --- | --- | --- |");
    for (const event of commandEvents) {
      lines.push(`| ${markdownEscape(event.ts)} | \`${markdownEscape(event.command)}\` | ${commandStatus(event)} | ${markdownEscape(commandSummary(event, reportDir))} |`);
    }
    lines.push("");
  }
  lines.push("## Machine-Readable Files", "");
  lines.push("Use these files for detailed command arguments, compact results, and automation replay/debugging:");
  lines.push(`- Run metadata: ${artifactLink(reportDir, { path: path.join(ctx.run.dir, "run.json") })}`);
  lines.push(`- Event stream: ${artifactLink(reportDir, { path: ctx.run.eventsPath })}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function defaultExportPath(ctx, format) {
  const extension = format === "zip" ? "zip" : "md";
  return path.join(ctx.conversation.dir, "exports", `ivista-run-${ctx.run.runId}.${extension}`);
}

export function exportRun(args = {}) {
  const ctx = currentRun({ create: false });
  if (!ctx.ok) return ctx;
  const format = String(args.format || "markdown").toLowerCase();
  if (!["markdown", "md", "zip"].includes(format)) {
    return { ok: false, error: `Unsupported export format: ${format}`, hints: ["Use --format markdown or --format zip."] };
  }
  const normalizedFormat = format === "md" ? "markdown" : format;
  const output = path.resolve(expandHome(args.output || defaultExportPath(ctx, normalizedFormat)));
  ensureDir(path.dirname(output));
  if (normalizedFormat === "markdown") {
    const markdown = buildRunMarkdown(ctx, output);
    fs.writeFileSync(output, markdown);
  } else {
    fs.writeFileSync(path.join(ctx.run.dir, "run-report.md"), buildRunMarkdown(ctx, path.join(ctx.run.dir, "run-report.md")));
    const outputInsideRun = output === ctx.run.dir || output.startsWith(`${ctx.run.dir}${path.sep}`);
    const zipOutput = outputInsideRun
      ? path.join(path.dirname(ctx.run.dir), `.ivista-export-${Date.now()}.zip`)
      : output;
    try {
      fs.unlinkSync(zipOutput);
    } catch {
      // Ignore missing previous export.
    }
    const runName = path.basename(ctx.run.dir);
    const ok = execTool("zip", ["-qry", zipOutput, runName, "-x", "*/._*", `${runName}/ivista-run-*`], path.dirname(ctx.run.dir))
      || execTool("ditto", ["-c", "-k", "--norsrc", "--keepParent", runName, zipOutput], path.dirname(ctx.run.dir));
    if (!ok) return { ok: false, error: "Unable to create zip export. Install ditto or zip." };
    if (zipOutput !== output) {
      try {
        fs.unlinkSync(output);
      } catch {
        // Ignore missing previous export.
      }
      ensureDir(path.dirname(output));
      fs.renameSync(zipOutput, output);
    }
  }
  appendRunEvent("export", { format: normalizedFormat, output }, ctx);
  return {
    ok: true,
    format: normalizedFormat,
    output,
    project: ctx.project,
    conversation: ctx.conversation,
    run: ctx.run,
  };
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

export async function toolRunExport(args = {}) {
  return jsonText(exportRun(args));
}
