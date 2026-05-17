import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { commandExists, ensureDir, expandHome, httpJson, jsonText, runCommand } from "./core.mjs";

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
  const hasUsableCapabilities = capabilities.includes("com.apple.coredevice.feature.disconnectdevice")
    || capabilities.includes("com.apple.coredevice.feature.installapp")
    || capabilities.includes("com.apple.coredevice.feature.launchapplication");
  const tunnelConnected = connection.tunnelState === "connected";
  const connected = connection.pairingState === "paired"
    && connection.tunnelState !== "unavailable"
    && (tunnelConnected || hasUsableCapabilities);
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
    tunnelIPAddress: connection.tunnelIPAddress || null,
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

function deviceCheck(ok, name, detail, hint = null) {
  return { ok, name, detail, hint };
}

function urlHost(host) {
  return String(host).includes(":") ? `[${host}]` : String(host);
}

export async function toolDeviceDiagnose(args = {}) {
  const checks = [];
  const hints = [];
  const hasDevicectl = await commandExists("xcrun");
  checks.push(deviceCheck(hasDevicectl, "xcrun available", hasDevicectl ? "found" : "missing", "Install Xcode command line tools and open Xcode once."));
  const hasIproxy = await commandExists("iproxy");
  checks.push(deviceCheck(hasIproxy, "iproxy available", hasIproxy ? "found" : "missing", "Install libimobiledevice with `brew install libimobiledevice` for USB forwarding."));

  let devices = [];
  try {
    devices = await listPhysicalDevices(args.timeoutMs || 15000);
  } catch (error) {
    return jsonText({
      ok: false,
      error: error.message,
      checks,
      hints: ["Run `xcrun devicectl list devices` to confirm Xcode can see the device."],
    });
  }

  const target = typeof args.device === "string" ? args.device : (args.udid || args.name || null);
  const device = target
    ? devices.find((item) => item.udid === target || item.identifier === target || item.name === target)
    : devices.find((item) => item.connected) || devices[0] || null;

  if (!device) {
    return jsonText({
      ok: false,
      error: "No iOS device found by devicectl.",
      devices,
      checks,
      hints: [
        "Connect the iPhone/iPad with USB once, unlock it, and tap Trust This Computer.",
        "Enable Developer Mode on the device.",
        "Open Xcode > Window > Devices and Simulators and wait until the device appears.",
      ],
    });
  }

  checks.push(deviceCheck(device.pairingState === "paired", "paired with Mac", device.pairingState || "unknown", "Unlock the device, tap Trust This Computer, then reconnect it."));
  checks.push(deviceCheck(device.developerModeStatus === "enabled", "Developer Mode", device.developerModeStatus || "unknown", "Enable Developer Mode in iOS Settings, then reconnect the device."));
  checks.push(deviceCheck(Boolean(device.connected), "CoreDevice connected", device.connected ? "connected" : "offline", "Keep the device unlocked and visible in Xcode Devices and Simulators."));
  checks.push(deviceCheck(Boolean(device.transportType), "transport detected", device.transportType || "unknown", "Reconnect USB once so Xcode can refresh the device record."));

  const wirelessReady = device.transportType === "localNetwork"
    && device.tunnelState === "connected"
    && Boolean(device.tunnelIPAddress);
  checks.push(deviceCheck(wirelessReady, "wireless CoreDevice tunnel", wirelessReady ? `${device.tunnelIPAddress}` : `${device.tunnelState || "unknown"} / ${device.transportType || "unknown"}`, "In Xcode Devices and Simulators, enable network connectivity for the device and keep it on the same Wi-Fi as the Mac."));

  let baseUrl = null;
  let wda = null;
  if (wirelessReady && args.port) {
    baseUrl = `http://${urlHost(device.tunnelIPAddress)}:${Number(args.port)}`;
    try {
      const response = await httpJson("GET", `${baseUrl}/status`, undefined, args.timeoutMs || 5000);
      wda = { ok: response.statusCode >= 200 && response.statusCode < 300, baseUrl, response };
      checks.push(deviceCheck(wda.ok, "WDA wireless /status", `${response.statusCode}`, "Start WDA with `ivista wda start --device <udid> --network --port <port>`."));
    } catch (error) {
      wda = { ok: false, baseUrl, error: error.message };
      checks.push(deviceCheck(false, "WDA wireless /status", error.message, "Start WDA with `ivista wda start --device <udid> --network --port <port>`."));
    }
  }

  for (const check of checks) {
    if (!check.ok && check.hint) hints.push(check.hint);
  }

  const ok = checks.every((check) => check.ok || check.name === "iproxy available" || (check.name === "WDA wireless /status" && !args.port));
  return jsonText({
    ok,
    device,
    wirelessReady,
    recommendedMode: wirelessReady ? "coredevice" : (hasIproxy ? "usb" : "unavailable"),
    baseUrl,
    wda,
    checks,
    hints: [...new Set(hints)],
  });
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
