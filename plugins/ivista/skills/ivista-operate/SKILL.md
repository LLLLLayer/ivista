---
name: ivista-operate
description: Use this skill when the user wants Codex to operate an already installed ivista CLI against a target iOS device through WebDriverAgent, including real iPhone/iPad operation, Simulator operation, WDA startup/status, screenshots, source reads, taps, text input, gestures, app launch/termination, alerts, device controls, or mobile smoke-test flows. For installing, updating, diagnosing, or preparing iVista, use the ivista-install skill instead.
---

# iVista Operate

iVista turns a target iOS device, either a Simulator or a real iPhone/iPad, into an Agent-operable test surface through the `ivista` CLI.

This plugin is skill-only. It does not expose MCP tools. Use the `ivista` CLI from the shell.

## Use

Read [references/usage.md](references/usage.md), then operate the device with the CLI.

If iVista is missing or broken, switch to the `ivista-install` skill first.

## Target Choice

Use the target the user names. If they mention a real iPhone, iPad, connected device, physical device, USB, wireless, signing, Developer Mode, or a device UDID, use the real-device path. If they mention Simulator, use the Simulator path. If they do not specify a target, inspect context: a connected, diagnosed real device may be used for limited non-destructive validation, while Simulator remains the lower-friction fallback.

Do not use iVista for generic web browser automation. Use browser tools for web pages.

## Safety

- Observe when state is uncertain, after navigation/state changes, and before retries or reports. Use targeted waits for tight action sequences.
- Avoid destructive app actions unless the user clearly requests them.
- On real devices, keep exploratory actions limited and reversible unless the user explicitly asks for deeper operation.
- Treat Simulator results as fast validation, not full real-device equivalence.
- For real devices, explain that signing, trust, Developer Mode, and port forwarding may still be required.
