import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ACCESSIBILITY_TIMEOUT_MS,
  findSourceMatches,
  findTextSuggestions,
  screenTextsFromXml,
} from "../src/accessibility.mjs";

const xml = `
<AppiumAUT>
  <XCUIElementTypeButton type="XCUIElementTypeButton" name="Settings" label="Settings" enabled="true" visible="true" accessible="true" x="20" y="40" width="120" height="44"/>
  <XCUIElementTypeStaticText type="XCUIElementTypeStaticText" name="Language &amp; Region" label="Language &amp; Region" enabled="true" visible="true" accessible="true" x="16" y="120" width="240" height="44"/>
  <XCUIElementTypeOther type="XCUIElementTypeOther" name="Hidden" visible="false" enabled="true" x="0" y="0" width="1" height="1"/>
</AppiumAUT>`;

test("finds exact accessibility text and computes center", () => {
  const matches = findSourceMatches(xml, { mode: "exact", text: "Settings" });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].center.x, 80);
  assert.equal(matches[0].center.y, 62);
});

test("decodes XML entities and finds contains matches", () => {
  const matches = findSourceMatches(xml, { mode: "contains", text: "Region" });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].matchedText.value, "Language & Region");
});

test("returns suggestions for nearby text", () => {
  const suggestions = findTextSuggestions(xml, { mode: "exact", text: "Lang" });
  assert.equal(suggestions[0].matchedText.value, "Language & Region");
});

test("extracts visible screen texts", () => {
  const payload = screenTextsFromXml(xml);
  assert.deepEqual(payload.texts, ["Settings", "Language & Region"]);
  assert.equal(payload.elements.length, 2);
});

test("uses a short default accessibility timeout", () => {
  assert.equal(DEFAULT_ACCESSIBILITY_TIMEOUT_MS, 5000);
});
