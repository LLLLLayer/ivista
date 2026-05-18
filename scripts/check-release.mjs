import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const currentTag = `v${version}`;

const failures = [];
const textExtensions = new Set([".md", ".json"]);
const ignoredDirs = new Set([".git", "ivista-wda", "node_modules"]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual}`);
  }
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const constants = fs.readFileSync(path.join(root, "src/cli/constants.mjs"), "utf8");
const cliVersion = constants.match(/CLI_VERSION\s*=\s*"([^"]+)"/)?.[1];
expectEqual("src/cli/constants.mjs CLI_VERSION", cliVersion, version);

expectEqual("plugins/ivista/.codex-plugin/plugin.json version", readJson("plugins/ivista/.codex-plugin/plugin.json").version, version);
expectEqual("plugins/ivista/.claude-plugin/plugin.json version", readJson("plugins/ivista/.claude-plugin/plugin.json").version, version);

const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
expectEqual(".claude-plugin/marketplace.json version", claudeMarketplace.version, version);
for (const plugin of claudeMarketplace.plugins ?? []) {
  if (plugin.name === "ivista") {
    expectEqual(".claude-plugin/marketplace.json plugins.ivista version", plugin.version, version);
  }
}

const installSkillReference = fs.readFileSync(
  path.join(root, "plugins/ivista/skills/ivista-install/references/install.md"),
  "utf8",
);
if (!installSkillReference.includes(`The pinned release for this skill is \`${currentTag}\``)) {
  failures.push("ivista-install skill pinned release does not match package version");
}
if (!installSkillReference.includes(`iVista CLI ${version}`)) {
  failures.push("ivista-install skill expected CLI version does not match package version");
}
if (!installSkillReference.includes(`ivista update --ref ${currentTag}`)) {
  failures.push("ivista-install skill update command does not match package version");
}

function collectTextFiles(dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTextFiles(absolutePath, out);
      continue;
    }
    const extension = path.extname(entry.name);
    if (textExtensions.has(extension) || entry.name === "SKILL.md") {
      out.push(path.relative(root, absolutePath));
    }
  }
  return out;
}

const textFiles = collectTextFiles();

const versionPattern = /\bv?\d+\.\d+\.\d+\b/g;

const head = git(["rev-parse", "HEAD"]);
const taggedCommit = git(["rev-parse", currentTag]);
if (taggedCommit && head && taggedCommit !== head) {
  failures.push(`${currentTag} points at ${taggedCommit}, not HEAD ${head}`);
}

for (const relativePath of textFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(versionPattern)];
    for (const item of matches) {
      const match = item[0];
      const before = line[item.index - 1] || "";
      const after = line[item.index + match.length] || "";
      if (before === "." || after === ".") continue;
      if (match === version || match === currentTag) continue;
      if (line.includes(`ivista-wda-${match}`) || line.includes(`ivista-wda-v${match}`)) continue;
      failures.push(`${relativePath}:${index + 1}: stale CLI version ${match}`);
    }
  });
}

if (failures.length > 0) {
  console.error("Release version check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`release version ok: ${version}`);
