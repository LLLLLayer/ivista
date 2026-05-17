import { ivistaHome, jsonText, runCommand, wdaConfig } from "./core.mjs";

export function doctorHint(name) {
  if (name === "xcodebuild") {
    return {
      hint: "Xcode command line tools are not available or xcode-select points to the wrong developer directory.",
      commands: [
        "xcode-select -p",
        "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
        "xcodebuild -version",
      ],
    };
  }
  if (name === "simctl") {
    return {
      hint: "Simulator tools are not available. This is usually caused by a broken Xcode selection.",
      commands: [
        "xcrun simctl list devices",
        "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
      ],
    };
  }
  if (name === "git") {
    return {
      hint: "Git is required so iVista can download and cache WebDriverAgent.",
      commands: [
        "git --version",
        "xcode-select --install",
      ],
    };
  }
  return {
    hint: "Check that this command is installed and available in PATH.",
    commands: [],
  };
}

export async function toolDoctor(args = {}) {
  const checks = [];
  for (const [name, command, commandArgs] of [
    ["xcodebuild", "xcodebuild", ["-version"]],
    ["simctl", "xcrun", ["simctl", "help"]],
    ["git", "git", ["--version"]],
  ]) {
    const result = await runCommand(command, commandArgs, { timeoutMs: args.timeoutMs || 10000 });
    checks.push({
      name,
      ok: result.ok,
      stdout: result.stdout.trim().split("\n").slice(0, 3).join("\n"),
      stderr: result.stderr.trim().split("\n").slice(0, 3).join("\n"),
      ...(result.ok ? {} : doctorHint(name)),
    });
  }
  const failedChecks = checks.filter((check) => !check.ok);
  return jsonText({
    ok: checks.every((check) => check.ok),
    ivistaHome: ivistaHome(),
    wda: wdaConfig(args),
    checks,
    hints: failedChecks.map((check) => ({
      name: check.name,
      hint: check.hint,
      commands: check.commands || [],
    })),
  });
}
