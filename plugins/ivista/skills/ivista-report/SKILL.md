---
name: ivista-report
description: Use this skill when the user wants Codex to export, package, summarize, share, or inspect iVista run artifacts from a mobile testing session, including Markdown reports, zip bundles, project/conversation/run timelines, screenshots, source XML, accessibility texts, and command event logs.
---

# iVista Report

Use this skill to turn an iVista mobile operation session into a report or debug bundle.

Read [references/report.md](references/report.md), then use the `ivista run ...` CLI commands.

## When To Use

- The user asks to export a report, conversation, run, timeline, reproduction material, or debug bundle.
- The user asks where screenshots/source/logs are saved.
- The user wants artifacts grouped by project or AI conversation.
- The user wants a Markdown report or zip archive from an iVista session.

## Guardrails

- Do not invent artifact paths. Run `ivista run current` first.
- Prefer `ivista run export --format markdown` for readable reports.
- Prefer `ivista run export --format zip` for sharing all raw artifacts.
- If no current run exists, ask whether to create one or run `ivista run start --project . --conversation <task-name>`.
