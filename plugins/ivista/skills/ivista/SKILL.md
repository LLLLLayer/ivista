---
name: ivista
description: Use iVista when the user wants Codex to inspect, boot, or operate an iOS Simulator or iPhone/iPad through WebDriverAgent, including screenshots, source reads, taps, text input, swipes, app launch/termination, WDA startup, or local mobile smoke-test flows.
---

# iVista

iVista turns an iOS Simulator, iPhone, or iPad into an Agent-operable test surface.

## When To Use

Use this skill when the user asks to:

- Operate an iOS Simulator or iPhone/iPad from Codex.
- Start or check WebDriverAgent.
- Take a mobile screenshot or read WDA source.
- Tap, type, swipe, press Home, launch an app, or terminate an app.
- Run a local smoke test or reproduce an iOS issue with screenshots and diagnostics.

Do not use iVista for generic web browser automation. Use browser tools for web pages.

## Default Flow

Prefer Simulator first unless the user explicitly asks for a real device.

1. Run `ivista_doctor`.
2. Run `ivista_simulator_list`.
3. If needed, run `ivista_simulator_boot`.
4. Run `ivista_wda_start_simulator`.
5. Use `ivista_screenshot` and `ivista_source` to observe.
6. Use deterministic actions such as `ivista_tap`, `ivista_input`, `ivista_swipe`, `ivista_launch_app`, and `ivista_terminate_app`.

## WDA Management

iVista manages WebDriverAgent by default. Users should not need to clone or download a WDA project manually.

- Default WDA repo: `https://github.com/appium/WebDriverAgent.git`.
- Default cache: `~/.ivista/cache/webdriveragent/<ref>/`.
- Override with `IVISTA_WDA_REPO`, `IVISTA_WDA_REF`, or `IVISTA_HOME`.
- Use explicit `wdaPath` only for offline use, enterprise forks, or WDA debugging.

## Safety

- Prefer screenshots and source reads before acting.
- Avoid destructive app actions unless the user clearly requests them.
- For real devices, explain that signing, trust, Developer Mode, and port forwarding may still be required.
- Treat Simulator results as fast validation, not full real-device equivalence.
