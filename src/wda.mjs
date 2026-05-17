import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_WDA_PORT,
  commandExists,
  createGitProgressRenderer,
  ensureDir,
  findAvailablePort,
  httpJson,
  ivistaHome,
  jsonText,
  runCommand,
  spawnDetached,
  wdaBaseUrl,
  wdaConfig,
} from "./core.mjs";
import { listSessions, removeSessionFile, sessionPort, writeSession } from "./sessions.mjs";
import {
  resolveHostSigning,
  resolvePhysicalDevice,
  resolveWdaSimulator,
  toolSimulatorBoot,
  wdaBundleIdFromSigning,
} from "./devices.mjs";

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
  fs.writeFileSync(path.join(cfg.cachePath, ".ivista-cache.json"), JSON.stringify(metadata, null, 2));
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

  if (!await commandExists("iproxy")) {
    throw new Error("iproxy is required for real-device WDA. Install libimobiledevice/usbmuxd, for example: `brew install libimobiledevice`.");
  }

  const prepared = await toolWdaPrepare(args);
  const preparedJson = JSON.parse(prepared.content[0].text);
  if (!preparedJson.ok) return prepared;

  const signing = args.signingTeam
    ? {
        developmentTeam: args.signingTeam,
        bundleId: args.hostBundleId || "com.ivista.host",
        containerType: null,
        containerPath: null,
        scheme: args.scheme || null,
        configuration: args.configuration || "Debug",
      }
    : await resolveHostSigning(args);
  const wdaBundleId = wdaBundleIdFromSigning(signing, args);

  const requestedPort = Number(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  const selectedPort = args.autoPort ? await findAvailablePort(requestedPort) : requestedPort;
  const port = String(selectedPort);
  const devicePort = String(args.devicePort || selectedPort);
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
  progressLine(`Starting iproxy ${selectedPort}:${devicePort}...`);
  const proxy = spawnDetached("iproxy", ["-u", device.udid, `${selectedPort}:${devicePort}`], { logDir, logPath: proxyLogPath });
  progressLine("Starting WebDriverAgent with xcodebuild...");
  progressLine(`Log: ${wdaLogPath}`);
  const spawned = spawnDetached("xcodebuild", xcodeArgs, { cwd: preparedJson.path, logDir, logPath: wdaLogPath });
  const baseUrl = `http://127.0.0.1:${port}`;
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
          },
          status: status.data,
        });
      }
    } catch (error) {
      lastError = error.message;
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
    },
    error: lastError || "Timed out waiting for real-device WDA /status.",
    hint: "Unlock the device, trust this Mac, keep Developer Mode enabled, then check the WDA and iproxy logs.",
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
  if (device.state !== "Booted") {
    progressLine(`Booting Simulator: ${device.name}`);
    const bootResult = await toolSimulatorBoot({ ...args, simulator: device.udid });
    const bootText = bootResult.content[0].text;
    const bootJson = JSON.parse(bootText);
    if (!bootJson.ok) return bootResult;
  }
  const prepared = await toolWdaPrepare(args);
  const preparedJson = JSON.parse(prepared.content[0].text);
  if (!preparedJson.ok) return prepared;

  const requestedPort = Number(args.port || process.env.IVISTA_WDA_PORT || DEFAULT_WDA_PORT);
  const selectedPort = args.autoPort ? await findAvailablePort(requestedPort) : requestedPort;
  const port = String(selectedPort);
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
  const baseUrl = `http://127.0.0.1:${port}`;
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
    if (progress && Date.now() >= nextProgressAt) {
      const elapsed = Math.round((Date.now() - startedWaitingAt) / 1000);
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      process.stderr.write(`Waiting for WDA /status... ${elapsed}s elapsed, ${remaining}s left\r`);
      nextProgressAt = Date.now() + 3000;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (progress) process.stderr.write("\n");
  return jsonText({
    ok: false,
    baseUrl,
    port: selectedPort,
    pid: spawned.pid,
    logPath: spawned.logPath,
    error: lastError || "Timed out waiting for WDA /status.",
    hint: "If WebDriverAgentRunner crashed or the port is busy, try `ivista wda stop` and then `ivista wda start --auto-port`.",
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
  const baseUrl = wdaBaseUrl(args);
  const response = await httpJson("GET", `${baseUrl}/status`, undefined, args.timeoutMs || 10000);
  return jsonText({ ok: response.statusCode >= 200 && response.statusCode < 300, baseUrl, response });
}
