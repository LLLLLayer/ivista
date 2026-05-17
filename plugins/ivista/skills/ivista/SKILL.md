---
name: ivista
description: Use iVista when the user wants Codex to install, update, diagnose, or use the ivista CLI to inspect, boot, or operate an iOS Simulator or iPhone/iPad through WebDriverAgent, including WDA startup/status, screenshots, source reads, taps, text input, gestures, app launch/termination, alerts, device controls, or local mobile smoke-test flows.
---

# iVista

iVista turns an iOS Simulator, iPhone, or iPad into an Agent-operable test surface through the `ivista` CLI.

This plugin is skill-only. It does not expose MCP tools. Use the `ivista` CLI from the shell.

## Route

Load only the reference that matches the user's intent:

- **Install or repair iVista**: read [references/install.md](references/install.md) when the user asks to install, update, verify, diagnose, fix `doctor` errors, set up the CLI, or recover a broken local install.
- **Use iVista**: read [references/usage.md](references/usage.md) when the user asks to operate a Simulator/device, start/check WDA, take screenshots, read source, tap/type/swipe/gesture, manage apps, handle alerts, or run a mobile smoke-test flow.

If the request mixes setup and usage, read `install.md` first, then `usage.md`.

## Default Choice

Prefer the Simulator path unless the user explicitly asks for a real iPhone/iPad.

Do not use iVista for generic web browser automation. Use browser tools for web pages.

## Safety

- Observe before acting: prefer `ivista screen shot` and `ivista screen source` before taps or gestures.
- Avoid destructive app actions unless the user clearly requests them.
- Treat Simulator results as fast validation, not full real-device equivalence.
- For real devices, explain that signing, trust, Developer Mode, and port forwarding may still be required.
