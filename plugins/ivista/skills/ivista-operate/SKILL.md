---
name: ivista-operate
description: Use this skill when the user wants Codex to operate an already installed ivista CLI against an iOS Simulator or iPhone/iPad through WebDriverAgent, including WDA startup/status, screenshots, source reads, taps, text input, gestures, app launch/termination, alerts, device controls, or mobile smoke-test flows. For installing, updating, diagnosing, or preparing iVista, use the ivista-install skill instead.
---

# iVista Operate

iVista turns an iOS Simulator, iPhone, or iPad into an Agent-operable test surface through the `ivista` CLI.

This plugin is skill-only. It does not expose MCP tools. Use the `ivista` CLI from the shell.

## Use

Read [references/usage.md](references/usage.md), then operate the device with the CLI.

If iVista is missing or broken, switch to the `ivista-install` skill first.

## Default Choice

Prefer the Simulator path unless the user explicitly asks for a real iPhone/iPad.

Do not use iVista for generic web browser automation. Use browser tools for web pages.

## Safety

- Observe when state is uncertain, after navigation/state changes, and before retries or reports. Use targeted waits for tight action sequences.
- Avoid destructive app actions unless the user clearly requests them.
- Treat Simulator results as fast validation, not full real-device equivalence.
- For real devices, explain that signing, trust, Developer Mode, and port forwarding may still be required.
