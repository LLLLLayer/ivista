import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const currentTag = `v${version}`;

const failures = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual}`);
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

const textFiles = [
  "README.md",
  "README.zh-CN.md",
  "docs/iVista-planning.md",
  "plugins/ivista/README.md",
  "plugins/ivista/skills/ivista-install/SKILL.md",
  "plugins/ivista/skills/ivista-install/references/install.md",
  "plugins/ivista/skills/ivista-operate/SKILL.md",
  "plugins/ivista/skills/ivista-operate/references/usage.md",
  "plugins/ivista/skills/ivista-report/SKILL.md",
  "plugins/ivista/skills/ivista-report/references/report.md",
  ".claude-plugin/marketplace.json",
  "plugins/ivista/.codex-plugin/plugin.json",
  "plugins/ivista/.claude-plugin/plugin.json"
];

const versionPattern = /\bv?0\.1\.\d+\b/g;

for (const relativePath of textFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = line.match(versionPattern) ?? [];
    for (const match of matches) {
      if (match === version || match === currentTag) continue;
      if (line.includes("ivista-wda-v")) continue;
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
