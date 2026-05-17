export function extractJson(result) {
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

export function simulatorRow(device, index, widths, prefix = "") {
  const number = `${index + 1}.`.padStart(widths.index);
  return `${prefix}${number}  ${simulatorState(device).padEnd(widths.state)}  ${device.name.padEnd(widths.name)}  ${device.udid}`;
}

export function simulatorWidths(devices) {
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

function printRun(payload) {
  if (!payload.ok) {
    console.log("No current iVista run.");
    if (payload.error) console.log(`error: ${payload.error}`);
    console.log("Start one with `ivista run start`.");
    return;
  }
  console.log("iVista Run");
  console.log("");
  console.log(`project: ${payload.project?.name || payload.project?.projectKey}`);
  console.log(`project key: ${payload.project?.projectKey}`);
  if (payload.project?.root) console.log(`root: ${asPath(payload.project.root)}`);
  if (payload.project?.gitRemote) console.log(`remote: ${payload.project.gitRemote}`);
  if (payload.project?.branch) console.log(`branch: ${payload.project.branch}`);
  console.log(`conversation: ${payload.conversation?.conversationId}`);
  console.log(`run: ${payload.run?.runId}`);
  if (payload.run?.dir) console.log(`path: ${asPath(payload.run.dir)}`);
  if (payload.run?.artifactDir) console.log(`artifacts: ${asPath(payload.run.artifactDir)}`);
  if (payload.run?.eventsPath) console.log(`events: ${asPath(payload.run.eventsPath)}`);
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

function printDeviceList(payload) {
  if (!payload.ok) {
    console.log(`Device list failed: ${payload.error || "unknown error"}`);
    return;
  }
  const devices = payload.devices || [];
  if (devices.length === 0) {
    console.log("No physical iOS devices found.");
    return;
  }
  console.log("Available iOS Devices");
  console.log("");
  const nameWidth = Math.max(...devices.map((device) => String(device.name || "").length), 4);
  const stateWidth = Math.max(...devices.map((device) => (device.connected ? "connected" : "offline").length), 7);
  const transportWidth = Math.max(...devices.map((device) => String(device.transportType || "unknown").length), 9);
  devices.forEach((device, index) => {
    const number = `${index + 1}.`.padStart(String(devices.length).length + 1);
    const state = (device.connected ? "connected" : "offline").padEnd(stateWidth);
    const name = String(device.name || "").padEnd(nameWidth);
    const transport = String(device.transportType || "unknown").padEnd(transportWidth);
    const os = device.osVersion ? ` iOS ${device.osVersion}` : "";
    console.log(`${number}  ${state}  ${transport}  ${name}  ${device.udid}${os}`);
  });
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
    if (payload.hint) console.log(`hint: ${payload.hint}`);
    for (const check of payload.checks || []) {
      console.log(`[FAIL] ${check.name}`);
      if (check.hint) console.log(`       ${check.hint}`);
    }
    for (const hint of payload.hints || []) {
      if (hint !== payload.hint) console.log(`hint: ${hint}`);
    }
    if (payload.logPath) console.log(`log: ${asPath(payload.logPath)}`);
    if (payload.baseUrl) console.log(`url: ${payload.baseUrl}`);
    const diagnosticLogs = payload.diagnostics?.logs || [];
    if (diagnosticLogs.length > 0) {
      console.log("");
      console.log("Last log lines:");
      for (const item of diagnosticLogs.slice(0, 2)) {
        console.log(`--- ${asPath(item.logPath)} ---`);
        console.log(item.tail.split("\n").slice(-12).join("\n"));
      }
    }
    return;
  }
  console.log(payload.reused ? "WDA is already running." : "WDA is running.");
  console.log(`url: ${payload.baseUrl}`);
  if (payload.targetType) console.log(`target: ${payload.targetType}`);
  if (payload.device?.name) console.log(`device: ${payload.device.name}`);
  if (payload.simulator?.name) console.log(`simulator: ${payload.simulator.name}`);
  if (payload.port) console.log(`port: ${payload.port}`);
  if (payload.pid) console.log(`pid: ${payload.pid}`);
  if (payload.proxyPid) console.log(`proxy pid: ${payload.proxyPid}`);
  if (payload.logPath) console.log(`log: ${asPath(payload.logPath)}`);
  if (payload.proxyLogPath) console.log(`proxy log: ${asPath(payload.proxyLogPath)}`);
  if (payload.signing?.wdaBundleId) console.log(`wda bundle id: ${payload.signing.wdaBundleId}`);
  if (payload.signing?.transportType) console.log(`transport: ${payload.signing.transportType}`);
}

function printWdaStop(payload) {
  if (!payload.ok) {
    console.log("WDA stop failed.");
    if (payload.error) console.log(`error: ${payload.error}`);
    return;
  }
  const stopped = payload.stopped || [];
  if (stopped.length === 0) {
    console.log("No WDA session found.");
    return;
  }
  console.log("WDA stop requested.");
  for (const item of stopped) {
    const status = item.ok ? "[OK]" : "[WARN]";
    const pid = item.pid ? ` pid=${item.pid}` : "";
    const proxyPid = item.proxyPid ? ` proxyPid=${item.proxyPid}` : "";
    console.log(`${status} ${item.target || item.simulator}${pid}${proxyPid}`);
    if (!item.ok && item.message) console.log(`       ${item.message}`);
  }
}

function printWdaStatus(payload) {
  console.log(payload.ok ? "WDA is reachable." : "WDA is not reachable.");
  if (payload.baseUrl) console.log(`url: ${payload.baseUrl}`);
}

function printCandidates(payload) {
  for (const item of (payload.candidates || payload.matches || []).slice(0, 8)) {
    if (item.summary) {
      console.log(`  ${item.summary}`);
      continue;
    }
    const rect = item.rect ? `x=${item.rect.x} y=${item.rect.y} w=${item.rect.width} h=${item.rect.height}` : "no rect";
    console.log(`  ${item.index}. ${item.type} ${item.field || "text"}="${item.text || ""}" ${rect}`);
  }
}

function printGeneric(commandKey, payload) {
  if (payload.ok === false) {
    console.log(`${commandKey} failed.`);
    if (payload.error) console.log(`error: ${payload.error}`);
    if (payload.candidates?.length || payload.matches?.length) {
      console.log("");
      console.log("Candidates:");
      printCandidates(payload);
    }
    for (const hint of payload.hints || []) console.log(`hint: ${hint}`);
    return;
  }
  if (commandKey === "screen shot") {
    const value = payload.response?.value;
    console.log("Screenshot captured.");
    if (payload.output) console.log(`output: ${asPath(payload.output)}`);
    if (payload.artifact?.path) console.log(`artifact: ${asPath(payload.artifact.path)}`);
    if (typeof value === "string") console.log(`base64 bytes: ${value.length}`);
    return;
  }
  if (commandKey === "screen source") {
    const value = payload.response?.value;
    console.log("Source captured.");
    if (payload.artifact?.path) console.log(`artifact: ${asPath(payload.artifact.path)}`);
    if (typeof value === "string") console.log(`chars: ${value.length}`);
    return;
  }
  if (commandKey === "screen texts") {
    console.log("Visible accessibility texts:");
    for (const text of payload.texts || []) console.log(`- ${text}`);
    console.log("");
    console.log(`elements: ${(payload.elements || []).length}`);
    if (payload.artifact?.path) console.log(`artifact: ${asPath(payload.artifact.path)}`);
    return;
  }
  if (commandKey === "wait text") {
    console.log("Text appeared.");
    if (payload.match?.summary) console.log(payload.match.summary);
    if (payload.elapsedMs !== undefined) console.log(`elapsed: ${payload.elapsedMs}ms`);
    return;
  }
  if (["act tap", "act double-tap", "act long-press"].includes(commandKey) && payload.selector) {
    console.log(`${commandKey} ok.`);
    if (payload.method) console.log(`method: ${payload.method}`);
    if (payload.match?.summary) console.log(`match: ${payload.match.summary}`);
    if (payload.point) console.log(`point: x=${payload.point.x} y=${payload.point.y}`);
    return;
  }
  if (["alert text", "alert buttons", "device locked", "device info", "device battery"].includes(commandKey)) {
    const value = payload.response?.value ?? payload.response;
    console.log(`${commandKey}:`);
    console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    return;
  }
  console.log(`${commandKey} ok.`);
}

function printHuman(commandKey, payload) {
  if (commandKey === "run start" || commandKey === "run current") return printRun(payload);
  if (commandKey === "doctor") return printDoctor(payload);
  if (commandKey === "simulator list") return printSimulatorList(payload);
  if (commandKey === "simulator boot") return printSimulatorBoot(payload);
  if (commandKey === "device list") return printDeviceList(payload);
  if (commandKey === "wda cache status") return printWdaCache(payload);
  if (commandKey === "wda prepare") return printWdaPrepare(payload);
  if (commandKey === "wda start") return printWdaStart(payload);
  if (commandKey === "wda stop") return printWdaStop(payload);
  if (commandKey === "wda status") return printWdaStatus(payload);
  return printGeneric(commandKey, payload);
}

export function printResult(commandKey, result, rawJson) {
  const payload = extractJson(result);
  if (rawJson || typeof payload !== "object") {
    console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    return;
  }
  printHuman(commandKey, payload);
}
