import { extractJson, simulatorRow, simulatorWidths } from "./formatters.mjs";

async function listSimulatorsForSelection(callTool, args) {
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

export async function resolveSimulatorIndex(callTool, args) {
  if (!/^\d+$/.test(String(args.simulator || ""))) return args;
  const devices = await listSimulatorsForSelection(callTool, args);
  const index = Number(args.simulator) - 1;
  if (index < 0 || index >= devices.length) {
    throw new Error(`Simulator #${args.simulator} was not found. Run \`ivista simulator list\` to see choices.`);
  }
  return { ...args, simulator: undefined, udid: devices[index].udid };
}

export async function chooseSimulator(callTool, args) {
  const devices = await listSimulatorsForSelection(callTool, args);
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
  process.stdin.setRawMode(true);
  process.stdin.resume();
  render();

  return await new Promise((resolve, reject) => {
    const cleanup = (clearScreen = false) => {
      process.stdin.setRawMode(Boolean(previousRawMode));
      process.stdin.off("data", onData);
      process.stdin.pause();
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
