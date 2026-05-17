import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureDir, expandHome, jsonText, runCommand } from "./core.mjs";

export async function toolSimulatorList(args = {}) {
  let devices = await listAvailableSimulators(args.timeoutMs || 15000);
  const total = devices.length;
  if (args.booted) devices = devices.filter((device) => device.state === "Booted");
  if (args.iphone) devices = devices.filter((device) => /^iPhone\b/.test(device.name));
  if (args.ipad) devices = devices.filter((device) => /^iPad\b/.test(device.name));
  if (!args.all) {
    const seen = new Set();
    devices = devices.filter((device) => {
      if (seen.has(device.name)) return false;
      seen.add(device.name);
      return true;
    });
  }
  return jsonText({ ok: true, devices, total, filtered: devices.length, compact: !args.all });
}

export async function listAvailableSimulators(timeoutMs = 15000) {
  const result = await runCommand("xcrun", ["simctl", "list", "devices", "available", "--json"], {
    timeoutMs,
  });
  if (!result.ok) throw new Error(result.stderr || result.stdout);
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    throw new Error("Unable to parse simctl JSON");
  }
  const devices = [];
  for (const [runtime, runtimeDevices] of Object.entries(data.devices || {})) {
    for (const device of runtimeDevices) {
      devices.push({
        runtime,
        name: device.name,
        udid: device.udid,
        state: device.state,
        isAvailable: device.isAvailable,
      });
    }
  }
  return devices;
}

export async function resolveSimulator(input) {
  if (!input) return null;
  const devices = await listAvailableSimulators();
  return devices.find((device) => device.udid === input || device.name === input) || null;
}

export async function resolveWdaSimulator(args = {}) {
  const target = args.simulator || args.name || args.udid;
  if (target) {
    const device = await resolveSimulator(target);
    if (!device) throw new Error(`Simulator not found: ${target}`);
    return { device, inferred: false };
  }

  const booted = (await listAvailableSimulators(args.timeoutMs || 15000))
    .filter((device) => device.state === "Booted");
  if (booted.length === 1) {
    return { device: booted[0], inferred: true };
  }
  if (booted.length === 0) {
    throw new Error("No booted Simulator found. Run `ivista simulator boot` or pass --simulator, --name, or --udid.");
  }
  const choices = booted.map((device, index) => `${index + 1}. ${device.name} (${device.udid})`).join("\n");
  throw new Error(`Multiple booted Simulators found:\n${choices}\nPass --simulator, --name, or --udid.`);
}

export function writeTempJsonPath(prefix) {
  ensureDir(path.join(os.tmpdir(), "ivista"));
  return path.join(os.tmpdir(), "ivista", `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

export function normalizePhysicalDevice(item) {
  const hardware = item.hardwareProperties || {};
  const properties = item.deviceProperties || {};
  const connection = item.connectionProperties || {};
  const capabilities = (item.capabilities || []).map((capability) => capability.featureIdentifier);
  const connected = capabilities.includes("com.apple.coredevice.feature.connectdevice")
    && connection.tunnelState !== "unavailable";
  return {
    name: properties.name || hardware.marketingName || item.identifier,
    udid: hardware.udid,
    identifier: item.identifier,
    platform: hardware.platform,
    deviceType: hardware.deviceType,
    productType: hardware.productType,
    osVersion: properties.osVersionNumber,
    developerModeStatus: properties.developerModeStatus,
    pairingState: connection.pairingState,
    transportType: connection.transportType || null,
    tunnelState: connection.tunnelState || null,
    connected,
  };
}

export async function listPhysicalDevices(timeoutMs = 15000) {
  const jsonPath = writeTempJsonPath("devicectl-devices");
  try {
    const result = await runCommand("xcrun", ["devicectl", "list", "devices", "--json-output", jsonPath], {
      timeoutMs,
    });
    if (!result.ok) throw new Error(result.stderr || result.stdout);
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    return (data.result?.devices || [])
      .map(normalizePhysicalDevice)
      .filter((device) => device.udid && device.platform === "iOS");
  } finally {
    try {
      fs.unlinkSync(jsonPath);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

export async function toolDeviceList(args = {}) {
  let devices = await listPhysicalDevices(args.timeoutMs || 15000);
  const total = devices.length;
  if (args.connected) devices = devices.filter((device) => device.connected);
  return jsonText({ ok: true, devices, total, filtered: devices.length });
}

export async function resolvePhysicalDevice(args = {}) {
  const target = typeof args.device === "string" ? args.device : (args.udid || args.name || null);
  const devices = await listPhysicalDevices(args.timeoutMs || 15000);
  const connected = devices.filter((device) => device.connected);
  if (target) {
    const device = devices.find((item) => item.udid === target || item.identifier === target || item.name === target);
    if (!device) throw new Error(`iOS device not found: ${target}`);
    if (!device.connected) {
      throw new Error(`iOS device is not connected: ${device.name} (${device.udid}). Unlock it, trust this Mac, enable Developer Mode, and reconnect USB.`);
    }
    return { device, inferred: false };
  }
  if (connected.length === 1) {
    return { device: connected[0], inferred: true };
  }
  if (connected.length === 0) {
    throw new Error("No connected iOS device found. Connect and unlock an iPhone/iPad, trust this Mac, enable Developer Mode, or pass --device <udid>.");
  }
  const choices = connected.map((device, index) => `${index + 1}. ${device.name} (${device.udid})`).join("\n");
  throw new Error(`Multiple connected iOS devices found:\n${choices}\nPass --device, --name, or --udid.`);
}

export async function toolSimulatorBoot(args = {}) {
  const target = args.simulator || args.name || args.udid;
  if (!target) throw new Error("Provide simulator, name, or udid.");
  const device = await resolveSimulator(target);
  if (!device) throw new Error(`Simulator not found: ${target}`);
  if (device.state !== "Booted") {
    const boot = await runCommand("xcrun", ["simctl", "boot", device.udid], {
      timeoutMs: args.timeoutMs || 60000,
    });
    if (!boot.ok && !/Unable to boot device in current state: Booted/i.test(boot.stderr)) {
      return jsonText({ ok: false, device, error: boot.stderr || boot.stdout });
    }
  }
  const bootstatus = await runCommand("xcrun", ["simctl", "bootstatus", device.udid, "-b"], {
    timeoutMs: args.timeoutMs || 120000,
  });
  return jsonText({
    ok: bootstatus.ok,
    device: { ...device, state: "Booted" },
    stdout: bootstatus.stdout.trim(),
    stderr: bootstatus.stderr.trim(),
  });
}

export function findXcodeContainers(cwd = process.cwd()) {
  let entries = [];
  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return { workspaces: [], projects: [] };
  }
  return {
    workspaces: entries.filter((entry) => entry.isDirectory() && entry.name.endsWith(".xcworkspace")).map((entry) => path.join(cwd, entry.name)),
    projects: entries.filter((entry) => entry.isDirectory() && entry.name.endsWith(".xcodeproj")).map((entry) => path.join(cwd, entry.name)),
  };
}

export function findNearestXcodeContainers(cwd = process.cwd()) {
  let current = path.resolve(cwd);
  const home = os.homedir();
  while (true) {
    const containers = findXcodeContainers(current);
    if (containers.workspaces.length > 0 || containers.projects.length > 0) {
      return { ...containers, directory: current };
    }
    const parent = path.dirname(current);
    if (parent === current || current === home) {
      return { workspaces: [], projects: [], directory: cwd };
    }
    current = parent;
  }
}

export async function inferXcodeScheme(containerArgs, timeoutMs = 30000) {
  const result = await runCommand("xcodebuild", ["-list", "-json", ...containerArgs], {
    cwd: process.cwd(),
    timeoutMs,
  });
  if (!result.ok) throw new Error(`Unable to list Xcode schemes: ${result.stderr || result.stdout}`);
  const data = JSON.parse(result.stdout);
  const schemes = data.workspace?.schemes || data.project?.schemes || [];
  if (schemes.length === 1) return schemes[0];
  if (schemes.length === 0) throw new Error("No Xcode schemes found. Pass --scheme <scheme>.");
  throw new Error(`Multiple Xcode schemes found: ${schemes.join(", ")}. Pass --scheme <scheme>.`);
}

export async function resolveHostSigning(args = {}) {
  const workspace = args.iosWorkspace || args.workspace;
  const project = args.iosProject || args.project;
  let containerArgs = [];
  let containerPath = null;
  let containerType = null;
  if (workspace) {
    containerPath = path.resolve(expandHome(workspace));
    containerType = "workspace";
    containerArgs = ["-workspace", containerPath];
  } else if (project) {
    containerPath = path.resolve(expandHome(project));
    containerType = "project";
    containerArgs = ["-project", containerPath];
  } else {
    const containers = findNearestXcodeContainers(process.cwd());
    if (containers.workspaces.length === 1) {
      containerPath = containers.workspaces[0];
      containerType = "workspace";
      containerArgs = ["-workspace", containerPath];
    } else if (containers.workspaces.length === 0 && containers.projects.length === 1) {
      containerPath = containers.projects[0];
      containerType = "project";
      containerArgs = ["-project", containerPath];
    } else if (containers.workspaces.length > 1 || containers.projects.length > 1) {
      throw new Error("Multiple Xcode projects/workspaces found. Pass --ios-project or --workspace.");
    } else {
      throw new Error("No Xcode project/workspace found. Run from an iOS project directory or pass --ios-project/--workspace.");
    }
  }

  const scheme = args.scheme || await inferXcodeScheme(containerArgs, args.timeoutMs || 30000);
  const configuration = args.configuration || "Debug";
  const result = await runCommand("xcodebuild", [
    "-showBuildSettings",
    "-json",
    ...containerArgs,
    "-scheme",
    scheme,
    "-configuration",
    configuration,
    "-destination",
    "generic/platform=iOS",
  ], {
    cwd: process.cwd(),
    timeoutMs: args.timeoutMs || 60000,
  });
  if (!result.ok) throw new Error(`Unable to read host app signing settings: ${result.stderr || result.stdout}`);
  const rows = JSON.parse(result.stdout);
  const row = rows.find((item) => {
    const settings = item.buildSettings || {};
    return settings.DEVELOPMENT_TEAM && settings.PRODUCT_BUNDLE_IDENTIFIER
      && (settings.PRODUCT_TYPE === "com.apple.product-type.application" || settings.WRAPPER_EXTENSION === "app");
  }) || rows.find((item) => item.buildSettings?.DEVELOPMENT_TEAM && item.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER);
  const settings = row?.buildSettings || {};
  if (!settings.DEVELOPMENT_TEAM) {
    throw new Error("Could not infer DEVELOPMENT_TEAM from the host project. Pass --signing-team <team-id>.");
  }
  if (!settings.PRODUCT_BUNDLE_IDENTIFIER) {
    throw new Error("Could not infer PRODUCT_BUNDLE_IDENTIFIER from the host project. Pass --wda-bundle-id <bundle-id>.");
  }
  return {
    containerType,
    containerPath,
    scheme,
    configuration,
    target: row.target,
    developmentTeam: settings.DEVELOPMENT_TEAM,
    bundleId: settings.PRODUCT_BUNDLE_IDENTIFIER,
    codeSignStyle: settings.CODE_SIGN_STYLE || null,
  };
}

export function wdaBundleIdFromSigning(signing, args = {}) {
  if (args.wdaBundleId) return args.wdaBundleId;
  return `${signing.bundleId}.ivista.wda`;
}
