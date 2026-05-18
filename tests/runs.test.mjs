import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { currentRun, saveRunArtifact, startRun } from "../src/runs.mjs";

test("creates project conversation run and saves artifacts under IVISTA_HOME", () => {
  const previousHome = process.env.IVISTA_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ivista-test-"));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "ivista-project-"));
  process.env.IVISTA_HOME = home;
  try {
    const started = startRun({ project, conversation: "conversation one", run: "run one" });
    assert.equal(started.ok, true);
    assert.equal(started.conversation.conversationId, "conversation-one");
    assert.equal(started.run.runId, "run-one");

    const artifact = saveRunArtifact({ project }, "observe-source", "xml", "<xml/>");
    assert.ok(fs.existsSync(artifact.path));
    assert.equal(path.basename(artifact.path), "0001-observe-source.xml");

    const current = currentRun();
    assert.equal(current.ok, true);
    assert.equal(current.run.runId, "run-one");
  } finally {
    if (previousHome === undefined) delete process.env.IVISTA_HOME;
    else process.env.IVISTA_HOME = previousHome;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
