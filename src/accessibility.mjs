import { jsonText } from "./core.mjs";
import { callWda } from "./sessions.mjs";

const TEXT_FIELDS = ["name", "label", "value"];
const DEFAULT_WAIT_MS = 10000;
const POLL_MS = 500;
const TYPE_PRIORITY = new Map([
  ["XCUIElementTypeButton", 0],
  ["XCUIElementTypeCell", 1],
  ["XCUIElementTypeLink", 1],
  ["XCUIElementTypeTextField", 1],
  ["XCUIElementTypeSecureTextField", 1],
  ["XCUIElementTypeSearchField", 1],
  ["XCUIElementTypeStaticText", 2],
  ["XCUIElementTypeOther", 5],
  ["XCUIElementTypeWindow", 9],
  ["XCUIElementTypeApplication", 10],
]);

function decodeXml(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function quotePredicate(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function elementId(element) {
  return element?.ELEMENT || element?.["element-6066-11e4-a52e-4f735466cecf"] || null;
}

function parseAttrs(raw) {
  const attrs = {};
  const pattern = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = pattern.exec(raw);
  while (match) {
    attrs[match[1]] = decodeXml(match[2] ?? match[3] ?? "");
    match = pattern.exec(raw);
  }
  return attrs;
}

function numericAttr(attrs, key) {
  const value = Number(attrs[key]);
  return Number.isFinite(value) ? value : null;
}

function uniqueTexts(attrs) {
  const seen = new Set();
  const out = [];
  for (const field of TEXT_FIELDS) {
    const value = String(attrs[field] || "").trim();
    if (!value || value === "(null)" || seen.has(value)) continue;
    seen.add(value);
    out.push({ field, value });
  }
  return out;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function parseWdaSource(xml) {
  const elements = [];
  const tagPattern = /<([A-Za-z][\w:.-]*)([^<>]*)\/?>/g;
  let match = tagPattern.exec(String(xml || ""));
  while (match) {
    const attrs = parseAttrs(match[2] || "");
    const texts = uniqueTexts(attrs);
    const x = numericAttr(attrs, "x");
    const y = numericAttr(attrs, "y");
    const width = numericAttr(attrs, "width");
    const height = numericAttr(attrs, "height");
    elements.push({
      type: attrs.type || match[1],
      name: attrs.name || "",
      label: attrs.label || "",
      value: attrs.value || "",
      enabled: attrs.enabled,
      visible: attrs.visible,
      accessible: attrs.accessible,
      rect: x === null || y === null || width === null || height === null ? null : { x, y, width, height },
      texts,
    });
    match = tagPattern.exec(String(xml || ""));
  }
  return elements;
}

export function resolveTextSelector(args = {}) {
  if (typeof args.regex === "string") return { mode: "regex", text: args.regex };
  if (typeof args.contains === "string") return { mode: "contains", text: args.contains };
  if (args.regex === true && typeof args.text === "string") return { mode: "regex", text: args.text };
  if (args.contains === true && typeof args.text === "string") return { mode: "contains", text: args.text };
  if (typeof args.text === "string") return { mode: "exact", text: args.text };
  throw new Error("Provide --text, --contains, or --regex.");
}

export function hasTextSelector(args = {}) {
  return typeof args.text === "string" || typeof args.contains === "string" || typeof args.regex === "string";
}

function buildPredicate(selector) {
  const quoted = quotePredicate(selector.text);
  if (selector.mode === "contains") {
    return TEXT_FIELDS.map((field) => `${field} CONTAINS[c] ${quoted}`).join(" OR ");
  }
  if (selector.mode === "regex") {
    return TEXT_FIELDS.map((field) => `${field} MATCHES[c] ${quoted}`).join(" OR ");
  }
  return TEXT_FIELDS.map((field) => `${field} ==[c] ${quoted}`).join(" OR ");
}

function makeMatcher(selector) {
  if (selector.mode === "regex") {
    const regex = new RegExp(selector.text, "i");
    return (value) => regex.test(String(value || ""));
  }
  if (selector.mode === "contains") {
    const needle = normalizeText(selector.text);
    return (value) => normalizeText(value).includes(needle);
  }
  const needle = normalizeText(selector.text);
  return (value) => normalizeText(value) === needle;
}

function isUsableElement(element) {
  if (element.visible === "false" || element.enabled === "false") return false;
  if (!element.rect) return true;
  return element.rect.width > 0 && element.rect.height > 0;
}

function centerOf(rect) {
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2),
  };
}

function areaOf(rect) {
  return rect ? rect.width * rect.height : Number.MAX_SAFE_INTEGER;
}

function fieldPriority(field) {
  const index = TEXT_FIELDS.indexOf(field);
  return index === -1 ? TEXT_FIELDS.length : index;
}

function typePriority(type) {
  return TYPE_PRIORITY.has(type) ? TYPE_PRIORITY.get(type) : 4;
}

function matchScore(element, matchedText, selector) {
  let score = 0;
  if (element.visible === "true") score += 100;
  if (element.enabled === "true") score += 80;
  if (element.accessible === "true") score += 40;
  score += Math.max(0, 30 - typePriority(element.type) * 5);
  score += Math.max(0, 20 - fieldPriority(matchedText?.field) * 5);
  const normalizedValue = normalizeText(matchedText?.value);
  const normalizedNeedle = normalizeText(selector.text);
  if (normalizedValue === normalizedNeedle) score += 50;
  if (selector.mode === "contains" && normalizedValue.startsWith(normalizedNeedle)) score += 12;
  if (element.rect) {
    const area = areaOf(element.rect);
    if (area > 0 && area < 200000) score += Math.max(0, 30 - Math.log10(area) * 5);
  }
  return Math.round(score * 100) / 100;
}

export function findSourceMatches(xml, selector) {
  const matcher = makeMatcher(selector);
  return parseWdaSource(xml)
    .map((element) => ({
      ...element,
      matchedText: element.texts.find((item) => matcher(item.value)) || null,
      matchedTexts: element.texts.filter((item) => matcher(item.value)),
      center: element.rect ? centerOf(element.rect) : null,
    }))
    .filter((element) => element.matchedText)
    .filter(isUsableElement)
    .map((element) => ({
      ...element,
      score: matchScore(element, element.matchedText, selector),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const areaDelta = areaOf(left.rect) - areaOf(right.rect);
      if (areaDelta !== 0) return areaDelta;
      return typePriority(left.type) - typePriority(right.type);
    });
}

export async function readSourceMatches(args = {}, selector = resolveTextSelector(args)) {
  const response = await callWda(args, "GET", ["/source", "/session/:sessionId/source"]);
  const xml = response.data?.value || response.data;
  if (typeof xml !== "string") throw new Error("WDA source response did not contain XML text.");
  return { xml, matches: findSourceMatches(xml, selector) };
}

export async function findWdaElementIds(args = {}, selector = resolveTextSelector(args)) {
  const response = await callWda(args, "POST", ["/session/:sessionId/elements"], {
    using: "predicate string",
    value: buildPredicate(selector),
  });
  return (response.data?.value || [])
    .map(elementId)
    .filter(Boolean);
}

export async function clickWdaElement(args = {}, id) {
  return await callWda(args, "POST", [`/session/:sessionId/element/${encodeURIComponent(id)}/click`], {});
}

export function selectorSummary(selector) {
  if (selector.mode === "exact") return `text "${selector.text}"`;
  return `${selector.mode} "${selector.text}"`;
}

export function candidateSummary(candidate, index) {
  const rect = candidate.rect
    ? `x=${candidate.rect.x} y=${candidate.rect.y} w=${candidate.rect.width} h=${candidate.rect.height}`
    : "no rect";
  const field = candidate.matchedText?.field || "text";
  const value = candidate.matchedText?.value || candidate.name || candidate.label || candidate.value || "";
  return {
    index: index + 1,
    type: candidate.type,
    field,
    text: value,
    score: candidate.score,
    rect: candidate.rect,
    center: candidate.center,
    summary: `${index + 1}. ${candidate.type} ${field}="${value}" score=${candidate.score ?? "n/a"} ${rect}`,
  };
}

export function elementNotFoundPayload(selector, candidates = []) {
  return jsonText({
    ok: false,
    error: `Element ${selectorSummary(selector)} not found.`,
    selector,
    candidates: candidates.map(candidateSummary),
    hints: [
      "Use --contains for partial text.",
      "Run `ivista screen texts` to inspect visible accessibility labels.",
      "Use coordinate tap as a fallback when the app has no useful accessibility labels.",
    ],
  });
}

export function indexFromArgs(args = {}) {
  const index = Number(args.index || 1);
  if (!Number.isInteger(index) || index < 1) throw new Error("Provide --index as a positive integer.");
  return index;
}

export async function waitForText(args = {}) {
  const selector = resolveTextSelector(args);
  const startedAt = Date.now();
  const timeoutMs = Number(args.timeoutMs || DEFAULT_WAIT_MS);
  while (Date.now() - startedAt <= timeoutMs) {
    const remaining = Math.max(1000, timeoutMs - (Date.now() - startedAt));
    const { matches } = await readSourceMatches({ ...args, timeoutMs: Math.min(remaining, 5000) }, selector);
    if (matches.length > 0) {
      return jsonText({
        ok: true,
        selector,
        elapsedMs: Date.now() - startedAt,
        match: candidateSummary(matches[0], 0),
        matches: matches.slice(0, 20).map(candidateSummary),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return jsonText({
    ok: false,
    selector,
    elapsedMs: Date.now() - startedAt,
    error: `Timed out waiting for ${selectorSummary(selector)} after ${timeoutMs}ms.`,
    hints: ["Check the current screen with `ivista screen texts`.", "Increase --timeout if the app is still loading."],
  });
}

export async function screenTexts(args = {}) {
  const response = await callWda(args, "GET", ["/source", "/session/:sessionId/source"]);
  const xml = response.data?.value || response.data;
  if (typeof xml !== "string") throw new Error("WDA source response did not contain XML text.");
  const elements = parseWdaSource(xml)
    .filter((element) => element.texts.length > 0)
    .filter(isUsableElement)
    .map((element, index) => ({
      index: index + 1,
      type: element.type,
      texts: element.texts,
      rect: element.rect,
      center: element.rect ? centerOf(element.rect) : null,
    }));
  const seen = new Set();
  const texts = [];
  for (const element of elements) {
    for (const item of element.texts) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      texts.push(item.value);
    }
  }
  return jsonText({ ok: true, texts, elements });
}
