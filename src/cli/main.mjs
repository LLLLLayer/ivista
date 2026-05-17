import { callTool as callRuntimeTool } from "../ivista-runtime.mjs";
import { normalizeOptions, parseArgs } from "./args.mjs";
import { resolveCommand } from "./commands.mjs";
import { printResult } from "./formatters.mjs";
import { printHelp, printVersion } from "./help.mjs";
import { chooseSimulator, resolveSimulatorIndex } from "./simulator-picker.mjs";
import { updateCli } from "./update.mjs";

async function callTool(tool, args) {
  return await callRuntimeTool(tool, args);
}

export async function main(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  if (options.version || positionals[0] === "version") {
    printVersion(Boolean(options.json));
    return;
  }
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
      const selected = await chooseSimulator(callTool, args);
      args.udid = selected.udid;
    } else {
      Object.assign(args, await resolveSimulatorIndex(callTool, args));
    }
  }
  if (!options.json && ["wda prepare", "wda start"].includes(command.key)) {
    args.progress = true;
  }
  const result = await callTool(command.tool, args);
  printResult(command.key, result, Boolean(options.json));
}
