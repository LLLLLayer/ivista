import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_WDA_PORT,
  commandExists,
  createGitProgressRenderer,
  ensureDir,
  findAvailablePort,
  httpJson,
  isPortAvailable,
  ivistaHome,
  jsonText,
  runCommand,
  spawnDetached,
  wdaConfig,
} from "./core.mjs";
import { listSessions, removeSessionFile, resolveWdaBaseUrl, sessionPort, writeSession } from "./sessions.mjs";
import {
  resolveHostSigning,
  resolvePhysicalDevice,
  resolveWdaSimulator,
  toolSimulatorBoot,
  wdaBundleIdFromSigning,
} from "./devices.mjs";

function parseToolJson(result) {
  return JSON.parse(result.content[0].text);
}

async function probeWda(baseUrl, timeoutMs = 3000) {
  try {
    const status = await httpJson("GET", `${baseUrl}/status`, undefined, timeoutMs);
    return {
      reachable: status.statusCode >= 200 && status.statusCode < 300,
      status,
      error: null,
    };
  } catch (error) {
    return { reachable: false, status: null, error: error.message };
  }
}

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLogTail(logPath, maxLines = 80) {
  if (!logPath) return "";
  try {
    return fs.readFileSync(logPath, "utf8").split(/\r?\n/).slice(-maxLines).join("\n").trim();
  } catch {
    return "";
  }
}

function diagnoseWdaText(text) {
  const hints = [];
  if (/Address already in use|port .* already in use|Failed to bind/i.test(text)) {
    hints.push("Port is busy. Run `ivista wda stop` or retry with `ivista wda start --auto-port`.");
  }
  if (/requires a development team|DEVELOPMENT_TEAM|No signing certificate|Code signing is required|Signing for .* requires/i.test(text)) {
    hints.push("WDA signing failed. Pass `--signing-team <TEAMID>` or run from an iOS app project so iVista can infer signing.");
  }
  if (/No profiles for|provisioning profile|allowProvisioningUpdates/i.test(text)) {
    hints.push("Provisioning failed. Keep `--allow-provisioning-updates` enabled and make sure the Apple account can create profiles for the WDA bundle id.");
  }
  if (/Unable to find a destination|Ineligible destinations|not registered for development|device.*not available/i.test(text)) {
    hints.push("Xcode could not use the target device. Unlock it, trust this Mac, enable Developer Mode, and reconnect USB.");
  }
  if (/Developer Mode/i.test(text)) {
    hints.push("Developer Mode is required on physical iOS devices.");
  }
  if (/WebDriverAgentRunner.*crash|Early unexpected exit|Test runner exited|UITestingUITests/i.test(text)) {
    hints.push("WDA runner crashed. Stop the old runner, then retry; if it repeats, inspect the WDA log and Simulator crash report.");
  }
  return [...new Set(hints)];
}

function collectWdaDiagnostics(paths) {
  const logs = paths
    .filter(Boolean)
    .map((logPath) => ({ logPath, tail: readLogTail(logPath) }))
    .filter((item) => item.tail);
  const hints = [...new Set(logs.flatMap((item) => diagnoseWdaText(item.tail)))];
  return { hints, logs };
}

function devicePreflightIssues(device) {
  const issues = [];
  if (device.developerModeStatus && device.developerModeStatus !== "enabled") {
    issues.push({
      name: "Developer Mode is not enabled",
      hint: "Enable Developer Mode on the iPhone/iPad, then reconnect it.",
    });
  }
  if (device.pairingState && device.pairingState !== "paired") {
    issues.push({
      name: "Device is not paired with this Mac",
      hint: "Unlock the device, tap Trust This Computer, then reconnect it.",
    });
  }
  return issues;
}

function iproxyArgsForDevice(device, args, selectedPort, devicePort) {
  const proxyArgs = ["-u", device.udid];
  const useNetwork = args.network || (!args.usb && device.transportType === "localNetwork");
  if (useNetwork) proxyArgs.push("-n");
  if (args.usb) proxyArgs.push("-l");
  proxyArgs.push(`${selectedPort}:${devicePort}`);
  return proxyArgs;
}

function urlHost(host) {
  return String(host).includes(":") ? `[${host}]` : String(host);
}

function usesCoreDeviceTunnel(device, args = {}) {
  return !args.usb
    && device.transportType === "localNetwork"
    && device.tunnelState === "connected"
    && Boolean(device.tunnelIPAddress);
}

function coreDeviceTunnelBaseUrl(device, port) {
  return `http://${urlHost(device.tunnelIPAddress)}:${port}`;
}

async function reuseReachableWda({ targetType, target, baseUrl, port, progressLine }) {
  const probe = await probeWda(baseUrl);
  if (!probe.reachable) return null;
  const sessions = listSessions();
  const matchesTarget = (data) => targetType === "device"
    ? data.device?.udid === target.udid || data.device?.name === target.name
    : data.simulator?.udid === target.udid || data.simulator?.name === target.name;
  const targetSession = sessions.find(({ data }) => matchesTarget(data))?.data || null;
  const portSession = sessions.find(({ data }) => data.baseUrl === baseUrl || sessionPort(data) === port)?.data || null;
  if (portSession && !matchesTarget(portSession)) return null;
  const targetSessionMatchesUrl = targetSession && (targetSession.baseUrl === baseUrl || sessionPort(targetSession) === port);
  const existing = portSession || (targetSessionMatchesUrl ? targetSession : {}) || {};
  const viaCoreDeviceTunnel = targetType === "device"
    && target.tunnelIPAddress
    && baseUrl.includes(urlHost(target.tunnelIPAddress));
  const refreshed = {
    ...existing,
    ...(viaCoreDeviceTunnel
      ? {
          proxyPid: null,
          proxyLogPath: null,
          signing: {
            ...(existing.signing || {}),
            transportType: target.transportType || null,
            tunnelIPAddress: target.tunnelIPAddress || null,
            proxyMode: "coredevice",
          },
        }
      : {}),
  };
  progressLine(`Reusing reachable WDA at ${baseUrl}`);
  if (targetType === "device") {
    writeSession(target.udid, {
      ...refreshed,
      targetType,
      device: target,
      baseUrl,
      port,
      updatedAt: new Date().toISOString(),
    });
  } else if (targetType === "simulator") {
    writeSession(target.udid, {
      ...refreshed,
      targetType,
      simulator: target,
      baseUrl,
      port,
      updatedAt: new Date().toISOString(),
    });
  }
  return jsonText({
    ok: true,
    reused: true,
    targetType,
    ...(targetType === "device" ? { device: target } : { simulator: target }),
    baseUrl,
    port,
    devicePort: refreshed.devicePort || null,
    pid: refreshed.pid || null,
    proxyPid: refreshed.proxyPid || null,
    logPath: refreshed.logPath || null,
    proxyLogPath: refreshed.proxyLogPath || null,
    signing: refreshed.signing || null,
    status: probe.status.data,
  });
}

export async function toolWdaPrepare(args = {}) {
  const cfg = wdaConfig(args);
  ensureDir(cfg.cacheRoot);
  const exists = fs.existsSync(path.join(cfg.cachePath, "WebDriverAgent.xcodeproj"));
  if (!exists && args.wdaPath) {
    return jsonText({ ok: false, error: `WDA project not found at ${cfg.cachePath}` });
  }
  if (!exists) {
    const progress = args.progress ? createGitProgressRenderer("Downloading WDA") : null;
    if (args.progress) process.stderr.write(`Downloading WDA ${cfg.ref}\n`);
    const clone = await runCommand("git", ["clone", "--progress", "--depth", "1", "--branch", cfg.ref, cfg.repo, cfg.cachePath], {
      timeoutMs: args.timeoutMs || 300000,
      onStderr: progress ? (chunk) => progress.update(chunk) : undefined,
    });
    if (progress) progress.done();
    if (!clone.ok) return jsonText({ ok: false, config: cfg, error: clone.stderr || clone.stdout });
  }
  const metadata = {
    repo: cfg.repo,
    ref: cfg.ref,
    path: cfg.cachePath,
    preparedAt: new Date().toISOString(),
  };
  if (!args.wdaPath) {
    fs.writeFileSync(path.join(cfg.cachePath, ".ivista-cache.json"), JSON.stringify(metadata, null, 2));
  }
  return jsonText({ ok: true, ...metadata });
}

export async function toolWdaCacheStatus(args = {}) {
  const cfg = wdaConfig(args);
  const exists = fs.existsSync(path.join(cfg.cachePath, "WebDriverAgent.xcodeproj"));
  let metadata = null;
  try {
    metadata = JSON.parse(fs.readFileSync(path.join(cfg.cachePath, ".ivista-cache.json"), "utf8"));
  } catch {
    metadata = null;
  }
  return jsonText({ ok: true, exists, config: cfg, metadata });
}

export async function toolWdaStartDevice(args = {}) {
  const progress = Boolean(args.progress);
  const progressLine = (text) => {
    if (progress) process.stderr.write(`${text}\n`);
  };
  progressLine("Preparing iOS device and WDA...");
  const { device, inferred } = await resolvePhysicalDevice(args);
  if (inferred) progressLine(`Using connected iOS device: ${device.name} (${device.udid})`);

  const requestedPort = Number(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  const useCoreDeviceTunnel = usesCoreDeviceTunnel(device, args);
  const requestedBaseUrl = useCoreDeviceTunnel
    ? coreDeviceTunnelBaseUrl(device, requestedPort)
    : `http://127.0.0.1:${requestedPort}`;
  const alreadyRunning = await reuseReachableWda({
    targetType: "device",
    target: device,
    baseUrl: requestedBaseUrl,
    port: requestedPort,
    progressLine,
  });
  if (alreadyRunning) return alreadyRunning;
  if (!useCoreDeviceTunnel && !args.autoPort && !await isPortAvailable(requestedPort)) {
    return jsonText({
      ok: false,
      targetType: "device",
      device,
      baseUrl: requestedBaseUrl,
      port: requestedPort,
      error: `Port ${requestedPort} is already in use, but WDA is not reachable there.`,
      hint: "Run `ivista wda stop` or retry with `ivista wda start --auto-port`.",
      hints: ["Run `ivista wda stop`.", "Retry with `ivista wda start --auto-port`."],
    });
  }

  if (!useCoreDeviceTunnel && !await commandExists("iproxy")) {
    return jsonText({
      ok: false,
      targetType: "device",
      device,
      error: "iproxy is required for real-device WDA.",
      hint: "Install libimobiledevice with `brew install libimobiledevice`, then retry.",
      hints: ["Install libimobiledevice with `brew install libimobiledevice`."],
    });
  }

  const preflightIssues = devicePreflightIssues(device);
  if (preflightIssues.length > 0) {
    return jsonText({
      ok: false,
      targetType: "device",
      device,
      error: "iOS device is not ready for WDA.",
      hint: preflightIssues[0].hint,
      checks: preflightIssues,
    });
  }

  const prepared = await toolWdaPrepare(args);
  const preparedJson = parseToolJson(prepared);
  if (!preparedJson.ok) return prepared;

  let signing;
  try {
    signing = args.signingTeam
      ? {
          developmentTeam: args.signingTeam,
          bundleId: args.hostBundleId || "com.ivista.host",
          containerType: null,
          containerPath: null,
          scheme: args.scheme || null,
          configuration: args.configuration || "Debug",
        }
      : await resolveHostSigning(args);
  } catch (error) {
    return jsonText({
      ok: false,
      targetType: "device",
      device,
      error: error.message,
      hint: "Run iVista from an iOS app project, or pass `--ios-project/--workspace --scheme`, or pass `--signing-team <TEAMID>`.",
      hints: [
        "Run from the app project directory so iVista can infer signing.",
        "Or pass `--ios-project <path> --scheme <scheme>`.",
        "Or pass `--signing-team <TEAMID> --wda-bundle-id <bundle-id>`.",
      ],
    });
  }
  const wdaBundleId = wdaBundleIdFromSigning(signing, args);

  const selectedPort = args.autoPort && !useCoreDeviceTunnel ? await findAvailablePort(requestedPort) : requestedPort;
  const port = String(selectedPort);
  const devicePort = String(args.devicePort || selectedPort);
  const baseUrl = useCoreDeviceTunnel
    ? coreDeviceTunnelBaseUrl(device, devicePort)
    : `http://127.0.0.1:${port}`;
  const logDir = path.join(ivistaHome(), "logs");
  ensureDir(logDir);
  const stamp = Date.now();
  const wdaLogPath = path.join(logDir, `wda-device-${device.udid}-${stamp}.log`);
  const proxyLogPath = path.join(logDir, `iproxy-${device.udid}-${stamp}.log`);
  const destination = `platform=iOS,id=${device.udid}`;
  const xcodeArgs = [
    "test",
    "-project",
    path.join(preparedJson.path, "WebDriverAgent.xcodeproj"),
    "-scheme",
    "WebDriverAgentRunner",
    "-destination",
    destination,
    "DEVELOPMENT_TEAM=" + signing.developmentTeam,
    "CODE_SIGN_STYLE=Automatic",
    "PRODUCT_BUNDLE_IDENTIFIER=" + wdaBundleId,
    "USE_PORT=" + devicePort,
  ];
  if (args.allowProvisioningUpdates !== false) xcodeArgs.splice(1, 0, "-allowProvisioningUpdates");

  progressLine(`Signing WDA with team: ${signing.developmentTeam}`);
  progressLine(`WDA bundle id: ${wdaBundleId}`);
  let proxy = { pid: null, logPath: null };
  let proxyMode = "coredevice";
  if (useCoreDeviceTunnel) {
    progressLine(`Using CoreDevice tunnel: ${baseUrl}`);
  } else {
    const proxyArgs = iproxyArgsForDevice(device, args, selectedPort, devicePort);
    proxyMode = proxyArgs.includes("-n") ? "network" : "usb";
    progressLine(`Starting iproxy ${selectedPort}:${devicePort} (${proxyMode})...`);
    proxy = spawnDetached("iproxy", proxyArgs, { logDir, logPath: proxyLogPath });
  }
  progressLine("Starting WebDriverAgent with xcodebuild...");
  progressLine(`Log: ${wdaLogPath}`);
  const spawned = spawnDetached("xcodebuild", xcodeArgs, { cwd: preparedJson.path, logDir, logPath: wdaLogPath });
  writeSession(device.udid, {
    targetType: "device",
    device,
    signing: {
      developmentTeam: signing.developmentTeam,
      hostBundleId: signing.bundleId,
      wdaBundleId,
      scheme: signing.scheme || null,
      configuration: signing.configuration || null,
      containerPath: signing.containerPath || null,
      transportType: device.transportType || null,
      tunnelIPAddress: device.tunnelIPAddress || null,
      proxyMode,
    },
    baseUrl,
    port: selectedPort,
    devicePort: Number(devicePort),
    pid: spawned.pid,
    proxyPid: proxy.pid,
    logPath: spawned.logPath,
    proxyLogPath: proxy.logPath,
    startedAt: new Date().toISOString(),
  });

  const deadline = Date.now() + (args.waitMs || 120000);
  const startedWaitingAt = Date.now();
  let nextProgressAt = 0;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const status = await httpJson("GET", `${baseUrl}/status`, undefined, 3000);
      if (status.statusCode >= 200 && status.statusCode < 300) {
        if (progress) process.stderr.write("\n");
        return jsonText({
          ok: true,
          targetType: "device",
          device,
          baseUrl,
          port: selectedPort,
          devicePort: Number(devicePort),
          pid: spawned.pid,
          proxyPid: proxy.pid,
          logPath: spawned.logPath,
          proxyLogPath: proxy.logPath,
          signing: {
            developmentTeam: signing.developmentTeam,
            hostBundleId: signing.bundleId,
            wdaBundleId,
            transportType: device.transportType || null,
            tunnelIPAddress: device.tunnelIPAddress || null,
            proxyMode,
          },
          status: status.data,
        });
      }
    } catch (error) {
      lastError = error.message;
    }
    if (!isProcessAlive(spawned.pid)) {
      lastError = "xcodebuild exited before WDA became reachable.";
      break;
    }
    if (progress && Date.now() >= nextProgressAt) {
      const elapsed = Math.round((Date.now() - startedWaitingAt) / 1000);
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      process.stderr.write(`Waiting for real-device WDA /status... ${elapsed}s elapsed, ${remaining}s left\r`);
      nextProgressAt = Date.now() + 3000;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (progress) process.stderr.write("\n");
  const diagnostics = collectWdaDiagnostics([wdaLogPath, proxyLogPath]);
  return jsonText({
    ok: false,
    targetType: "device",
    device,
    baseUrl,
    port: selectedPort,
    devicePort: Number(devicePort),
    pid: spawned.pid,
    proxyPid: proxy.pid,
    logPath: spawned.logPath,
    proxyLogPath: proxy.logPath,
    signing: {
      developmentTeam: signing.developmentTeam,
      hostBundleId: signing.bundleId,
      wdaBundleId,
      transportType: device.transportType || null,
      tunnelIPAddress: device.tunnelIPAddress || null,
      proxyMode,
    },
    error: lastError || "Timed out waiting for real-device WDA /status.",
    hint: diagnostics.hints[0] || "Unlock the device, trust this Mac, keep Developer Mode enabled, then check the WDA and iproxy logs.",
    hints: diagnostics.hints,
    diagnostics,
  });
}

export async function toolWdaStartSimulator(args = {}) {
  if (args.device || args.realDevice) return await toolWdaStartDevice(args);
  const progress = Boolean(args.progress);
  const progressLine = (text) => {
    if (progress) process.stderr.write(`${text}\n`);
  };
  progressLine("Preparing Simulator and WDA...");
  const { device, inferred } = await resolveWdaSimulator(args);
  if (inferred) progressLine(`Using booted Simulator: ${device.name} (${device.udid})`);
  const requestedPort = Number(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  const requestedBaseUrl = `http://127.0.0.1:${requestedPort}`;
  const alreadyRunning = await reuseReachableWda({
    targetType: "simulator",
    target: device,
    baseUrl: requestedBaseUrl,
    port: requestedPort,
    progressLine,
  });
  if (alreadyRunning) return alreadyRunning;
  if (!args.autoPort && !await isPortAvailable(requestedPort)) {
    return jsonText({
      ok: false,
      targetType: "simulator",
      simulator: device,
      baseUrl: requestedBaseUrl,
      port: requestedPort,
      error: `Port ${requestedPort} is already in use, but WDA is not reachable there.`,
      hint: "Run `ivista wda stop` or retry with `ivista wda start --auto-port`.",
      hints: ["Run `ivista wda stop`.", "Retry with `ivista wda start --auto-port`."],
    });
  }
  if (device.state !== "Booted") {
    progressLine(`Booting Simulator: ${device.name}`);
    const bootResult = await toolSimulatorBoot({ ...args, simulator: device.udid });
    const bootJson = parseToolJson(bootResult);
    if (!bootJson.ok) return bootResult;
  }
  const prepared = await toolWdaPrepare(args);
  const preparedJson = parseToolJson(prepared);
  if (!preparedJson.ok) return prepared;

  const selectedPort = args.autoPort ? await findAvailablePort(requestedPort) : requestedPort;
  const port = String(selectedPort);
  const baseUrl = `http://127.0.0.1:${port}`;
  const logDir = path.join(ivistaHome(), "logs");
  ensureDir(logDir);
  const logPath = path.join(logDir, `wda-simulator-${device.udid}-${Date.now()}.log`);
  const destination = `platform=iOS Simulator,id=${device.udid}`;
  const xcodeArgs = [
    "test",
    "-project",
    path.join(preparedJson.path, "WebDriverAgent.xcodeproj"),
    "-scheme",
    "WebDriverAgentRunner",
    "-destination",
    destination,
    "USE_PORT=" + port,
  ];
  progressLine(`Starting WebDriverAgent with xcodebuild...`);
  progressLine(`Log: ${logPath}`);
  const spawned = spawnDetached("xcodebuild", xcodeArgs, { cwd: preparedJson.path, logDir, logPath });
  writeSession(device.udid, {
    targetType: "simulator",
    simulator: device,
    baseUrl,
    port: selectedPort,
    pid: spawned.pid,
    logPath: spawned.logPath,
    startedAt: new Date().toISOString(),
  });

  const deadline = Date.now() + (args.waitMs || 90000);
  const startedWaitingAt = Date.now();
  let nextProgressAt = 0;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const status = await httpJson("GET", `${baseUrl}/status`, undefined, 3000);
      if (status.statusCode >= 200 && status.statusCode < 300) {
        if (progress) process.stderr.write("\n");
        return jsonText({
          ok: true,
          baseUrl,
          port: selectedPort,
          pid: spawned.pid,
          logPath: spawned.logPath,
          status: status.data,
        });
      }
    } catch (error) {
      lastError = error.message;
    }
    if (!isProcessAlive(spawned.pid)) {
      lastError = "xcodebuild exited before WDA became reachable.";
      break;
    }
    if (progress && Date.now() >= nextProgressAt) {
      const elapsed = Math.round((Date.now() - startedWaitingAt) / 1000);
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      process.stderr.write(`Waiting for WDA /status... ${elapsed}s elapsed, ${remaining}s left\r`);
      nextProgressAt = Date.now() + 3000;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (progress) process.stderr.write("\n");
  const diagnostics = collectWdaDiagnostics([logPath]);
  return jsonText({
    ok: false,
    baseUrl,
    port: selectedPort,
    pid: spawned.pid,
    logPath: spawned.logPath,
    error: lastError || "Timed out waiting for WDA /status.",
    hint: diagnostics.hints[0] || "If WebDriverAgentRunner crashed or the port is busy, try `ivista wda stop` and then `ivista wda start --auto-port`.",
    hints: diagnostics.hints,
    diagnostics,
  });
}

export async function toolWdaStop(args = {}) {
  const wantedPort = args.port ? Number(args.port) : null;
  const wantedTarget = args.simulator || args.device || args.udid || args.name || null;
  const sessions = listSessions();
  const matching = sessions.filter(({ data }) => {
    if (wantedPort && sessionPort(data) !== wantedPort) return false;
    if (wantedTarget && data.simulator?.udid !== wantedTarget && data.simulator?.name !== wantedTarget) return false;
    if (wantedTarget && data.device?.udid !== wantedTarget && data.device?.name !== wantedTarget) return false;
    return data.targetType === "simulator" || data.targetType === "device";
  });
  const targets = matching.length > 0 ? matching : [{ file: null, data: { simulator: { udid: wantedTarget || "booted" } } }];
  const stopped = [];
  for (const { file, data } of targets) {
    if (data.pid) {
      try {
        process.kill(data.pid, "SIGTERM");
      } catch {
        // xcodebuild may already be gone.
      }
    }
    if (data.proxyPid) {
      try {
        process.kill(data.proxyPid, "SIGTERM");
      } catch {
        // iproxy may already be gone.
      }
    }
    let terminate = { ok: true, stderr: "", stdout: "" };
    const targetType = data.targetType || "simulator";
    const target = data.simulator?.udid || data.device?.udid || wantedTarget || "booted";
    if (targetType === "simulator") {
      terminate = await runCommand("xcrun", ["simctl", "terminate", target, "com.facebook.WebDriverAgentRunner.xctrunner"], {
        timeoutMs: args.timeoutMs || 15000,
      });
    }
    if (file) removeSessionFile(file);
    stopped.push({
      targetType,
      target,
      pid: data.pid || null,
      proxyPid: data.proxyPid || null,
      ok: terminate.ok || /not running|No such process|The operation couldn/i.test(terminate.stderr),
      message: (terminate.stderr || terminate.stdout || "").trim(),
    });
  }
  return jsonText({ ok: true, stopped });
}

export async function toolWdaStatus(args = {}) {
  const baseUrl = resolveWdaBaseUrl(args);
  const response = await httpJson("GET", `${baseUrl}/status`, undefined, args.timeoutMs || 10000);
  return jsonText({ ok: response.statusCode >= 200 && response.statusCode < 300, baseUrl, response });
}
