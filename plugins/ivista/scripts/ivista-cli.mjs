#!/usr/bin/env node
import { spawn } from "node:child_process";
import { callTool as callRuntimeTool } from "./ivista-runtime.mjs";

const CLI_VERSION = "0.1.10";
const INSTALL_REPO = "git+https://github.com/LLLLLayer/ivista.git";

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
  console.log(`iVista CLI ${CLI_VERSION}

Usage:
  ivista update [--ref main]
  ivista doctor [--json]
  ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
  ivista simulator boot
  ivista simulator boot 1
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
  --all                   Show all Simulator runtimes instead of a compact deduped list.
  --booted                Show only running Simulators.
  --iphone                Show only iPhone Simulators.
  --ipad                  Show only iPad Simulators.
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

function runInherited(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.on("close", (code) => resolve(code || 0));
  });
}

async function updateCli(options) {
  const ref = options.ref || "main";
  const spec = `${INSTALL_REPO}#${ref}`;
  console.log(`Updating iVista CLI from ${spec}`);
  console.log("");
  const code = await runInherited("npm", ["install", "-g", spec]);
  if (code !== 0) process.exit(code);
  console.log("");
  console.log("iVista CLI updated.");
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
    if (["json", "help", "all", "booted", "iphone", "ipad"].includes(key)) {
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
  if (positionals[0] === "simulator" && positionals[1] === "boot" && positionals[2] && !out.simulator && !out.name && !out.udid) {
    out.simulator = positionals[2];
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

async function callTool(tool, args) {
  return await callRuntimeTool(tool, args);
}

function extractJson(result) {
  const text = result?.content?.find((item) => item.type === "text")?.text || "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function mark(ok) {
  return ok ? "[OK]" : "[FAIL]";
}

function asPath(value) {
  return String(value || "").replace(process.env.HOME || "", "~");
}

function simulatorState(device) {
  return device.state === "Booted" ? "booted" : "off";
}

function simulatorRow(device, index, widths, prefix = "") {
  const number = `${index + 1}.`.padStart(widths.index);
  return `${prefix}${number}  ${simulatorState(device).padEnd(widths.state)}  ${device.name.padEnd(widths.name)}  ${device.udid}`;
}

function simulatorWidths(devices) {
  return {
    index: String(devices.length).length + 1,
    state: Math.max(...devices.map((device) => simulatorState(device).length), 3),
    name: Math.max(...devices.map((device) => device.name.length), 4),
  };
}

function printDoctor(payload) {
  console.log("iVista Doctor");
  console.log("");
  for (const check of payload.checks || []) {
    const detail = check.stdout ? ` ${check.stdout.split("\n")[0]}` : "";
    console.log(`${mark(check.ok)} ${check.name}${detail}`);
    if (!check.ok && check.stderr) console.log(`       ${check.stderr}`);
  }
  console.log("");
  console.log(`iVista home: ${asPath(payload.ivistaHome)}`);
  console.log(`WDA ref: ${payload.wda?.ref || "unknown"}`);
  console.log(`WDA cache: ${asPath(payload.wda?.cachePath || "")}`);
  console.log("");
  if (payload.ok) {
    console.log("Ready for Simulator testing.");
    return;
  }
  console.log("Some checks failed.");
  for (const item of payload.hints || []) {
    console.log("");
    console.log(`${item.name}: ${item.hint}`);
    for (const command of item.commands || []) {
      console.log(`  ${command}`);
    }
  }
  console.log("");
  console.log("Run `ivista doctor --json` for full details.");
}

function printSimulatorList(payload) {
  const devices = payload.devices || [];
  if (!payload.ok) {
    console.log(`Simulator list failed: ${payload.error || "unknown error"}`);
    return;
  }
  if (devices.length === 0) {
    console.log("No available iOS Simulators found.");
    return;
  }
  console.log("Available Simulators");
  console.log("");
  const widths = simulatorWidths(devices);
  devices.forEach((device, index) => console.log(simulatorRow(device, index, widths)));
  if (payload.compact && payload.total > devices.length) {
    console.log("");
    console.log(`Showing ${devices.length} compact results. ${payload.total} simulators total.`);
    console.log("Use --all to show every runtime, --iphone/--ipad to filter.");
    console.log("Run `ivista simulator boot` to choose with arrow keys.");
  }
}

function printSimulatorBoot(payload) {
  if (!payload.ok) {
    console.log("Simulator did not boot.");
    if (payload.error) console.log(`error: ${payload.error}`);
    if (payload.stderr) console.log(payload.stderr);
    console.log("");
    console.log("Try `ivista simulator list --booted` to check whether it finished booting anyway.");
    console.log("If this was only slow, retry with `ivista simulator boot --timeout 180000`.");
    return;
  }
  console.log("Simulator is booted.");
  if (payload.device?.name) console.log(`name: ${payload.device.name}`);
  if (payload.device?.udid) console.log(`udid: ${payload.device.udid}`);
}

function printWdaCache(payload) {
  if (!payload.ok) {
    console.log(`WDA cache check failed: ${payload.error || "unknown error"}`);
    return;
  }
  console.log("WDA Cache");
  console.log("");
  console.log(`${payload.exists ? "[OK]" : "[MISS]"} ${asPath(payload.config?.cachePath || payload.path || "")}`);
  if (payload.config?.ref) console.log(`ref: ${payload.config.ref}`);
  if (payload.config?.repo) console.log(`repo: ${payload.config.repo}`);
}

function printWdaPrepare(payload) {
  if (!payload.ok) {
    console.log(`WDA prepare failed: ${payload.error || "unknown error"}`);
    return;
  }
  console.log("WDA is ready.");
  console.log(`path: ${asPath(payload.path)}`);
  console.log(`ref: ${payload.ref}`);
}

function printWdaStart(payload) {
  if (!payload.ok) {
    console.log("WDA did not become ready.");
    if (payload.error) console.log(`error: ${payload.error}`);
    if (payload.logPath) console.log(`log: ${asPath(payload.logPath)}`);
    if (payload.baseUrl) console.log(`url: ${payload.baseUrl}`);
    return;
  }
  console.log("WDA is running.");
  console.log(`url: ${payload.baseUrl}`);
  if (payload.pid) console.log(`pid: ${payload.pid}`);
  if (payload.logPath) console.log(`log: ${asPath(payload.logPath)}`);
}

function printWdaStatus(payload) {
  console.log(payload.ok ? "WDA is reachable." : "WDA is not reachable.");
  if (payload.baseUrl) console.log(`url: ${payload.baseUrl}`);
}

function printGeneric(commandKey, payload) {
  if (payload.ok === false) {
    console.log(`${commandKey} failed.`);
    if (payload.error) console.log(`error: ${payload.error}`);
    return;
  }
  if (commandKey === "screen shot") {
    const value = payload.response?.value;
    console.log("Screenshot captured.");
    if (typeof value === "string") console.log(`base64 bytes: ${value.length}`);
    return;
  }
  if (commandKey === "screen source") {
    const value = payload.response?.value;
    console.log("Source captured.");
    if (typeof value === "string") console.log(`chars: ${value.length}`);
    return;
  }
  console.log(`${commandKey} ok.`);
}

function printHuman(commandKey, payload) {
  if (commandKey === "doctor") return printDoctor(payload);
  if (commandKey === "simulator list") return printSimulatorList(payload);
  if (commandKey === "simulator boot") return printSimulatorBoot(payload);
  if (commandKey === "wda cache status") return printWdaCache(payload);
  if (commandKey === "wda prepare") return printWdaPrepare(payload);
  if (commandKey === "wda start") return printWdaStart(payload);
  if (commandKey === "wda status") return printWdaStatus(payload);
  return printGeneric(commandKey, payload);
}

function printResult(commandKey, result, rawJson) {
  const payload = extractJson(result);
  if (rawJson || typeof payload !== "object") {
    console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    return;
  }
  printHuman(commandKey, payload);
}

async function listSimulatorsForSelection(args) {
  const result = await callTool("ivista_simulator_list", {
    all: args.all,
    booted: args.booted,
    iphone: args.iphone,
    ipad: args.ipad,
    ...(args.timeoutMs ? { timeoutMs: args.timeoutMs } : {}),
  });
  const payload = extractJson(result);
  if (!payload.ok) throw new Error(payload.error || "Unable to list simulators.");
  return payload.devices || [];
}

async function resolveSimulatorIndex(args) {
  if (!/^\d+$/.test(String(args.simulator || ""))) return args;
  const devices = await listSimulatorsForSelection(args);
  const index = Number(args.simulator) - 1;
  if (index < 0 || index >= devices.length) {
    throw new Error(`Simulator #${args.simulator} was not found. Run \`ivista simulator list\` to see choices.`);
  }
  return { ...args, simulator: undefined, udid: devices[index].udid };
}

async function chooseSimulator(args) {
  const devices = await listSimulatorsForSelection(args);
  if (devices.length === 0) throw new Error("No available iOS Simulators found.");
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive selection requires a terminal. Use `ivista simulator boot 1` or `--name/--udid`.");
  }

  let selected = 0;
  const widths = simulatorWidths(devices);
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
    process.stdout.write("Choose a Simulator\n\n");
    devices.forEach((device, index) => {
      const row = simulatorRow(device, index, widths, index === selected ? "> " : "  ");
      process.stdout.write(index === selected ? `\x1b[7m${row}\x1b[0m\n` : `${row}\n`);
    });
    process.stdout.write("\nUse Up/Down, Enter to boot, q to cancel.\n");
  };

  const previousRawMode = process.stdin.isRaw;
  const wasPaused = process.stdin.isPaused();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  render();

  return await new Promise((resolve, reject) => {
    const cleanup = (clearScreen = false) => {
      process.stdin.setRawMode(Boolean(previousRawMode));
      process.stdin.off("data", onData);
      if (wasPaused) process.stdin.pause();
      process.stdout.write(clearScreen ? "\x1b[2J\x1b[H\x1b[?25h" : "\x1b[?25h\n");
    };
    const onData = (chunk) => {
      const key = chunk.toString("utf8");
      if (key === "\u0003" || key === "q" || key === "\u001b") {
        cleanup();
        reject(new Error("Selection cancelled."));
        return;
      }
      if (key === "\r" || key === "\n") {
        cleanup(true);
        resolve(devices[selected]);
        return;
      }
      if (key === "\u001b[A") {
        selected = selected === 0 ? devices.length - 1 : selected - 1;
        render();
        return;
      }
      if (key === "\u001b[B") {
        selected = selected === devices.length - 1 ? 0 : selected + 1;
        render();
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  if (options.help || positionals.length === 0) {
    printHelp();
    return;
  }
  if (positionals[0] === "update") {
    await updateCli(options);
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
  if (command.key === "simulator boot") {
    if (!args.simulator && !args.name && !args.udid) {
      const selected = await chooseSimulator(args);
      args.udid = selected.udid;
    } else {
      Object.assign(args, await resolveSimulatorIndex(args));
    }
  }
  const result = await callTool(command.tool, args);
  printResult(command.key, result, Boolean(options.json));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
