import fs from "node:fs";
import path from "node:path";

import { ensureDir, expandHome, jsonText } from "./core.mjs";
import { saveRunArtifact } from "./runs.mjs";
import { callWda } from "./sessions.mjs";
import {
  candidateSummary,
  clickWdaElement,
  elementNotFoundPayload,
  findWdaElementIds,
  hasTextSelector,
  indexFromArgs,
  readSourceMatches,
  resolveTextSelector,
  screenTexts,
  waitForText,
} from "./accessibility.mjs";

export async function toolScreenshot(args = {}) {
  const response = await callWda(args, "GET", ["/screenshot", "/session/:sessionId/screenshot"]);
  let output = null;
  const value = response.data?.value || response.data;
  if (typeof value !== "string") throw new Error("WDA screenshot response did not contain base64 image data.");
  const image = Buffer.from(value, "base64");
  const artifact = saveRunArtifact(args, "screenshot", "png", image);
  if (args.output) {
    output = path.resolve(expandHome(args.output));
    ensureDir(path.dirname(output));
    fs.writeFileSync(output, image);
  }
  return jsonText({ ok: true, output, artifact, response: response.data });
}

export async function toolSource(args = {}) {
  const response = await callWda(args, "GET", ["/source", "/session/:sessionId/source"]);
  const value = response.data?.value || response.data;
  const artifact = typeof value === "string" ? saveRunArtifact(args, "source", "xml", value) : null;
  return jsonText({ ok: true, artifact, response: response.data });
}

export async function toolScreenTexts(args = {}) {
  const result = await screenTexts(args);
  const payload = JSON.parse(result.content[0].text);
  const artifact = saveRunArtifact(args, "texts", "json", `${JSON.stringify(payload, null, 2)}\n`);
  return jsonText({ ...payload, artifact });
}

export async function toolTap(args = {}) {
  if (hasTextSelector(args)) return await toolTapText(args);
  const x = Number(args.x);
  const y = Number(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Provide numeric x and y.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/tap", "/wda/tap"], { x, y });
  return jsonText({ ok: true, response: response.data });
}

async function coordinateTap(args, point) {
  return await callWda(args, "POST", ["/session/:sessionId/wda/tap", "/wda/tap"], point);
}

async function coordinateDoubleTap(args, point) {
  return await callWda(args, "POST", ["/session/:sessionId/wda/doubleTap", "/wda/doubleTap"], point);
}

async function coordinateLongPress(args, point) {
  const duration = Number(args.duration || 1);
  if (!Number.isFinite(duration)) throw new Error("Provide numeric duration.");
  return await callWda(args, "POST", ["/session/:sessionId/wda/touchAndHold", "/wda/touchAndHold"], {
    ...point,
    duration,
  });
}

async function sourcePointForText(args, selector) {
  const selectedIndex = indexFromArgs(args);
  const { matches } = await readSourceMatches(args, selector);
  const candidate = matches[selectedIndex - 1];
  if (!candidate) return { ok: false, matches };
  if (!candidate.center) {
    return {
      ok: false,
      matches,
      error: `Matched ${selector.mode} "${selector.text}", but the element has no usable rect.`,
    };
  }
  return { ok: true, candidate, matches, point: candidate.center };
}

async function textCoordinateGesture(args, gestureName, invoke) {
  const selector = resolveTextSelector(args);
  const target = await sourcePointForText(args, selector);
  if (!target.ok) {
    const payload = JSON.parse(elementNotFoundPayload(selector, target.matches || []).content[0].text);
    if (target.error) payload.error = target.error;
    return jsonText(payload);
  }
  const response = await invoke(args, target.point);
  return jsonText({
    ok: true,
    gesture: gestureName,
    selector,
    point: target.point,
    match: candidateSummary(target.candidate, indexFromArgs(args) - 1),
    response: response.data,
  });
}

export async function toolTapText(args = {}) {
  const selector = resolveTextSelector(args);
  const selectedIndex = indexFromArgs(args);
  const target = await sourcePointForText(args, selector);
  let coordinateTapError = null;
  if (target.ok) {
    try {
      const response = await coordinateTap(args, target.point);
      return jsonText({
        ok: true,
        gesture: "tap",
        method: "rect-center",
        selector,
        point: target.point,
        match: candidateSummary(target.candidate, selectedIndex - 1),
        response: response.data,
      });
    } catch (error) {
      coordinateTapError = error.message;
      // Fall through to element click. Some WDA/device combinations reject coordinate taps.
    }
  }
  let elementLookupError = null;
  let elementIds = [];
  try {
    elementIds = await findWdaElementIds(args, selector);
  } catch (error) {
    elementLookupError = error.message;
  }
  const id = elementIds[selectedIndex - 1];
  if (id) {
    try {
      const response = await clickWdaElement(args, id);
      return jsonText({
        ok: true,
        gesture: "tap",
        method: "element-click",
        selector,
        index: selectedIndex,
        match: target.ok ? candidateSummary(target.candidate, selectedIndex - 1) : null,
        response: response.data,
      });
    } catch {
      // Fall back to the source rect center below; element click can be flaky on some WDA builds.
    }
  }
  if (!target.ok) {
    const payload = JSON.parse(elementNotFoundPayload(selector, target.matches || []).content[0].text);
    if (elementLookupError) payload.elementLookupError = elementLookupError;
    return jsonText(payload);
  }
  return jsonText({
    ok: false,
    gesture: "tap",
    method: "rect-center",
    selector,
    point: target.point,
    match: candidateSummary(target.candidate, selectedIndex - 1),
    error: coordinateTapError || "Matched element, but tap failed.",
    hints: ["Retry with coordinate tap using the printed point.", "If another element is intended, pass --index <n> after inspecting candidates with `ivista screen texts`."],
  });
}

export function coordinateBody(args = {}) {
  const x = Number(args.x);
  const y = Number(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Provide numeric x and y.");
  return { x, y };
}

export async function toolInput(args = {}) {
  if (typeof args.text !== "string") throw new Error("Provide text.");
  const body = { value: [...args.text], text: args.text };
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/keys", "/session/:sessionId/keys", "/wda/keys"], body);
  return jsonText({ ok: true, response: response.data });
}

export function swipePoints(args = {}) {
  if (["up", "down", "left", "right"].includes(args.direction)) {
    const width = Number(args.width || 390);
    const height = Number(args.height || 844);
    const midX = Math.round(width / 2);
    const midY = Math.round(height / 2);
    const spanX = Math.round(width * 0.35);
    const spanY = Math.round(height * 0.35);
    if (args.direction === "up") return { fromX: midX, fromY: midY + spanY, toX: midX, toY: midY - spanY };
    if (args.direction === "down") return { fromX: midX, fromY: midY - spanY, toX: midX, toY: midY + spanY };
    if (args.direction === "left") return { fromX: midX + spanX, fromY: midY, toX: midX - spanX, toY: midY };
    return { fromX: midX - spanX, fromY: midY, toX: midX + spanX, toY: midY };
  }
  return {
    fromX: Number(args.fromX),
    fromY: Number(args.fromY),
    toX: Number(args.toX),
    toY: Number(args.toY),
  };
}

export async function toolSwipe(args = {}) {
  const points = swipePoints(args);
  for (const [key, value] of Object.entries(points)) {
    if (!Number.isFinite(value)) throw new Error(`Provide numeric ${key}, or use direction.`);
  }
  const body = { ...points, duration: Number(args.duration || 0.25) };
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/dragfromtoforduration"], body);
  return jsonText({ ok: true, response: response.data });
}

export async function toolDoubleTap(args = {}) {
  if (hasTextSelector(args)) return await textCoordinateGesture(args, "double-tap", coordinateDoubleTap);
  const response = await coordinateDoubleTap(args, coordinateBody(args));
  return jsonText({ ok: true, response: response.data });
}

export async function toolTwoFingerTap(args = {}) {
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/twoFingerTap", "/wda/twoFingerTap"], {});
  return jsonText({ ok: true, response: response.data });
}

export async function toolLongPress(args = {}) {
  if (hasTextSelector(args)) return await textCoordinateGesture(args, "long-press", coordinateLongPress);
  const duration = Number(args.duration || 1);
  if (!Number.isFinite(duration)) throw new Error("Provide numeric duration.");
  const response = await coordinateLongPress(args, coordinateBody(args));
  return jsonText({ ok: true, response: response.data });
}

export async function toolWaitText(args = {}) {
  return await waitForText(args);
}

export async function toolDrag(args = {}) {
  const points = swipePoints(args);
  for (const [key, value] of Object.entries(points)) {
    if (!Number.isFinite(value)) throw new Error(`Provide numeric ${key}.`);
  }
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/dragfromtoforduration", "/wda/dragfromtoforduration"], {
    ...points,
    duration: Number(args.duration || 0.5),
  });
  return jsonText({ ok: true, response: response.data });
}

export async function toolPinch(args = {}) {
  const scale = Number(args.scale);
  const velocity = Number(args.velocity);
  if (!Number.isFinite(scale) || !Number.isFinite(velocity)) throw new Error("Provide numeric scale and velocity.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/pinch", "/wda/pinch"], { scale, velocity });
  return jsonText({ ok: true, response: response.data });
}

export async function toolRotate(args = {}) {
  const rotation = Number(args.rotation);
  const velocity = Number(args.velocity);
  if (!Number.isFinite(rotation) || !Number.isFinite(velocity)) throw new Error("Provide numeric rotation and velocity.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/rotate", "/wda/rotate"], { rotation, velocity });
  return jsonText({ ok: true, response: response.data });
}

export async function toolHome(args = {}) {
  const response = await callWda(args, "POST", ["/wda/homescreen", "/session/:sessionId/wda/homescreen"]);
  return jsonText({ ok: true, response: response.data });
}

export async function toolKeyboardDismiss(args = {}) {
  const body = args.keyNames ? { keyNames: String(args.keyNames).split(",").map((item) => item.trim()).filter(Boolean) } : {};
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/keyboard/dismiss", "/wda/keyboard/dismiss"], body);
  return jsonText({ ok: true, response: response.data });
}

export async function toolAlertAccept(args = {}) {
  const response = await callWda(args, "POST", ["/session/:sessionId/alert/accept", "/alert/accept"], args.name ? { name: args.name } : {});
  return jsonText({ ok: true, response: response.data });
}

export async function toolAlertDismiss(args = {}) {
  const response = await callWda(args, "POST", ["/session/:sessionId/alert/dismiss", "/alert/dismiss"], args.name ? { name: args.name } : {});
  return jsonText({ ok: true, response: response.data });
}

export async function toolAlertText(args = {}) {
  const response = await callWda(args, "GET", ["/session/:sessionId/alert/text", "/alert/text"]);
  return jsonText({ ok: true, response: response.data });
}

export async function toolAlertInput(args = {}) {
  if (typeof args.text !== "string") throw new Error("Provide text.");
  const response = await callWda(args, "POST", ["/session/:sessionId/alert/text", "/alert/text"], { value: args.text });
  return jsonText({ ok: true, response: response.data });
}

export async function toolAlertButtons(args = {}) {
  const response = await callWda(args, "GET", ["/session/:sessionId/wda/alert/buttons", "/wda/alert/buttons"]);
  return jsonText({ ok: true, response: response.data });
}

export async function toolDeviceLock(args = {}) {
  const response = await callWda(args, "POST", ["/wda/lock", "/session/:sessionId/wda/lock"], {});
  return jsonText({ ok: true, response: response.data });
}

export async function toolDeviceUnlock(args = {}) {
  const response = await callWda(args, "POST", ["/wda/unlock", "/session/:sessionId/wda/unlock"], {});
  return jsonText({ ok: true, response: response.data });
}

export async function toolDeviceLocked(args = {}) {
  const response = await callWda(args, "GET", ["/wda/locked", "/session/:sessionId/wda/locked"]);
  return jsonText({ ok: true, response: response.data });
}

export async function toolDeviceInfo(args = {}) {
  const response = await callWda(args, "GET", ["/wda/device/info", "/session/:sessionId/wda/device/info"]);
  return jsonText({ ok: true, response: response.data });
}

export async function toolDeviceBattery(args = {}) {
  const response = await callWda(args, "GET", ["/session/:sessionId/wda/batteryInfo", "/wda/batteryInfo"]);
  return jsonText({ ok: true, response: response.data });
}

export async function toolDevicePress(args = {}) {
  if (!args.name) throw new Error("Provide button name, for example volumeUp or volumeDown.");
  const body = { name: args.name };
  if (args.duration !== undefined) body.duration = Number(args.duration);
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/pressButton", "/wda/pressButton"], body);
  return jsonText({ ok: true, response: response.data });
}

export async function toolLaunchApp(args = {}) {
  if (!args.bundleId) throw new Error("Provide bundleId.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/apps/launch"], {
    bundleId: args.bundleId,
    arguments: args.arguments || [],
    environment: args.environment || {},
  });
  return jsonText({ ok: true, response: response.data });
}

export async function toolTerminateApp(args = {}) {
  if (!args.bundleId) throw new Error("Provide bundleId.");
  const response = await callWda(args, "POST", ["/session/:sessionId/wda/apps/terminate"], {
    bundleId: args.bundleId,
  });
  return jsonText({ ok: true, response: response.data });
}
