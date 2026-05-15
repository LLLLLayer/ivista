---
name: ivista
description: Use iVista when the user wants Codex to install or use the ivista CLI to inspect, boot, or operate an iOS Simulator or iPhone/iPad through WebDriverAgent, including screenshots, source reads, taps, text input, swipes, app launch/termination, WDA startup, or local mobile smoke-test flows.
---

# iVista

iVista turns an iOS Simulator, iPhone, or iPad into an Agent-operable test surface through the `ivista` CLI.

## When To Use

Use this skill when the user asks to:

- Operate an iOS Simulator or iPhone/iPad from Codex.
- Install or update the `ivista` CLI.
- Start or check WebDriverAgent.
- Take a mobile screenshot or read WDA source.
- Tap, type, swipe, press Home, launch an app, or terminate an app.
- Run a local smoke test or reproduce an iOS issue with screenshots and diagnostics.

Do not use iVista for generic web browser automation. Use browser tools for web pages.

## CLI Installation

This plugin is skill-only. It does not expose MCP tools. Use the `ivista` CLI from the shell.

The plugin bundle should remain plugin-only. The CLI source lives outside the plugin directory in the repository-level `bin/` and `src/` folders, and users install it through the npm package.

Before using iVista, check whether the CLI is installed:

```bash
command -v ivista
ivista doctor
```

If `ivista` is missing, install it:

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.19
```

To update an existing install, run:

```bash
ivista update
```

If the user wants a local development install from the checked-out repo, run:

```bash
npm install -g .
```

## Default Flow

Prefer Simulator first unless the user explicitly asks for a real device.

1. Run `ivista doctor`.
2. Run `ivista simulator list`.
3. If needed, run `ivista simulator boot --name "<Simulator Name>"`.
4. Run `ivista wda start --simulator "<Simulator Name>" --auto-port`.
5. Use `ivista screen shot --output /tmp/ivista.png` and `ivista screen source` to observe.
6. Use deterministic actions such as `ivista act home`, `ivista act tap`, `ivista act double-tap`, `ivista act long-press`, `ivista act drag`, `ivista act pinch`, `ivista act input`, `ivista act swipe`, `ivista keyboard dismiss`, `ivista alert accept`, `ivista device info`, `ivista app launch`, and `ivista app terminate`.
7. Run `ivista wda stop --port <port>` when the user wants to stop the current WDA runner.

## WDA Management

iVista manages WebDriverAgent by default. Users should not need to clone or download a WDA project manually.

- Default WDA repo: `https://github.com/appium/WebDriverAgent.git`.
- Default cache: `~/.ivista/cache/webdriveragent/<ref>/`.
- Override with `IVISTA_WDA_REPO`, `IVISTA_WDA_REF`, or `IVISTA_HOME`.
- Use explicit `--wda-path` only for offline use, enterprise forks, or WDA debugging.
- Use `--auto-port` if the default port is busy or a previous WebDriverAgent runner crashed.

## Safety

- Prefer screenshots and source reads before acting.
- Avoid destructive app actions unless the user clearly requests them.
- For real devices, explain that signing, trust, Developer Mode, and port forwarding may still be required.
- Treat Simulator results as fast validation, not full real-device equivalence.
