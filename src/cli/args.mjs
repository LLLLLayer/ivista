const booleanOptions = new Set([
  "json",
  "help",
  "version",
  "all",
  "booted",
  "iphone",
  "ipad",
  "auto-port",
  "connected",
  "real-device",
  "network",
  "usb",
  "allow-provisioning-updates",
  "create",
]);

const aliases = {
  "bundle-id": "bundleId",
  "base-url": "baseUrl",
  "wda-path": "wdaPath",
  "ios-project": "iosProject",
  "ios-workspace": "iosWorkspace",
  "signing-team": "signingTeam",
  "host-bundle-id": "hostBundleId",
  "wda-bundle-id": "wdaBundleId",
  "device-port": "devicePort",
  "real-device": "realDevice",
  "allow-provisioning-updates": "allowProvisioningUpdates",
  "auto-port": "autoPort",
  "from-x": "fromX",
  "from-y": "fromY",
  "to-x": "toX",
  "to-y": "toY",
  "key-names": "keyNames",
  "stable-ms": "stableMs",
  "poll-ms": "pollMs",
};

const numericOptions = [
  "port",
  "devicePort",
  "timeout",
  "wait",
  "x",
  "y",
  "width",
  "height",
  "fromX",
  "fromY",
  "toX",
  "toY",
  "duration",
  "scale",
  "velocity",
  "rotation",
  "index",
  "stableMs",
  "pollMs",
];

export function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (booleanOptions.has(key)) {
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

export function normalizeOptions(options, positionals) {
  const out = {};
  for (const [key, value] of Object.entries(options)) {
    const normalized = aliases[key] || key;
    out[normalized] = value;
  }
  for (const key of numericOptions) {
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
  if (positionals[0] === "alert" && positionals[1] === "input" && typeof out.text !== "string") {
    out.text = positionals.slice(2).join(" ");
  }
  if (positionals[0] === "wait" && positionals[1] === "text" && typeof out.text !== "string" && typeof out.contains !== "string" && typeof out.regex !== "string") {
    out.text = positionals.slice(2).join(" ");
  }
  if (positionals[0] === "wait" && positionals[1] === "gone" && typeof out.text !== "string" && typeof out.contains !== "string" && typeof out.regex !== "string") {
    out.text = positionals.slice(2).join(" ");
  }
  if (positionals[0] === "wait" && positionals[1] === "app" && typeof out.bundleId !== "string") {
    out.bundleId = positionals.slice(2).join(" ");
  }
  if (positionals[0] === "act" && ["tap", "double-tap", "long-press"].includes(positionals[1]) && typeof out.text !== "string" && typeof out.contains !== "string" && typeof out.regex !== "string") {
    const text = positionals.slice(2).join(" ");
    if (text) out.text = text;
  }
  if (positionals[0] === "simulator" && positionals[1] === "boot" && positionals[2] && !out.simulator && !out.name && !out.udid) {
    out.simulator = positionals[2];
  }
  return out;
}
