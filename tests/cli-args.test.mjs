import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOptions, parseArgs } from "../src/cli/args.mjs";
import { resolveCommand } from "../src/cli/commands.mjs";

test("normalizes text action options and scroll aliases", () => {
  const { positionals, options } = parseArgs(["act", "tap", "--contains", "Wi-Fi", "--scroll", "--max-scrolls", "3", "--scroll-direction", "down"]);
  const normalized = normalizeOptions(options, positionals);
  assert.equal(resolveCommand(positionals).key, "act tap");
  assert.equal(normalized.contains, "Wi-Fi");
  assert.equal(normalized.scroll, true);
  assert.equal(normalized.maxScrolls, 3);
  assert.equal(normalized.scrollDirection, "down");
});

test("uses positional input text", () => {
  const { positionals, options } = parseArgs(["act", "input", "hello", "from", "ivista"]);
  const normalized = normalizeOptions(options, positionals);
  assert.equal(normalized.text, "hello from ivista");
});

test("routes cleanup and WDA list commands", () => {
  assert.equal(resolveCommand(["cleanup"]).tool, "ivista_cleanup");
  assert.equal(resolveCommand(["wda", "list"]).tool, "ivista_wda_list");
});
