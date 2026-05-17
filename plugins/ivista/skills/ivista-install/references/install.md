# iVista Installation

Use this reference when the user asks to install, update, verify, diagnose, or repair the `ivista` CLI and its Simulator or real-device environment.

## Core Facts

- The Codex Plugin is skill-only. It does not include MCP tools.
- The plugin bundle should remain plugin-only.
- The CLI source lives outside the plugin directory in repository-level `bin/` and `src/`.
- Users install the CLI through the npm package.
- Users should not manually clone WebDriverAgent for normal use. iVista downloads and caches the pinned WDA ref automatically.

## Check Existing Install

```bash
command -v ivista
ivista version
ivista doctor
```

If `ivista doctor` reports issues, prefer following its fix hints before attempting manual repair.

## Install

Install the released CLI from the GitHub npm package source:

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.24
```

For local development from a checked-out repo:

```bash
npm install -g .
```

## Update

```bash
ivista update
```

To update from a specific branch or ref:

```bash
ivista update --ref main
```

## Verify CLI

```bash
ivista version
ivista doctor
```

## Simulator Setup

Use this when the user wants Simulator support. Do not make the user manually open Xcode unless the CLI check fails.

```bash
ivista simulator list
```

If no Simulators are available, explain that they need an iOS Simulator runtime installed in Xcode. The usual manual path is Xcode Settings > Platforms, then install an iOS runtime. After that rerun:

```bash
ivista simulator list
ivista simulator boot
```

`ivista simulator boot` provides an interactive picker. A booted Simulator means the Simulator is already running and can be used by WDA.

If the user wants to validate the WDA cache without launching a Simulator:

```bash
ivista wda cache status
ivista wda prepare
ivista wda cache status
```

## Real Device Setup

Use this when the user explicitly wants a real iPhone or iPad.

Check device visibility:

```bash
ivista device list --connected
```

Check the port forwarding dependency:

```bash
command -v iproxy
```

If `iproxy` is missing:

```bash
brew install libimobiledevice
```

Real-device prerequisites:

- Device is connected, unlocked, paired/trusted with this Mac, and Developer Mode is enabled.
- Xcode can build a normal iOS app to that device.
- The user is usually inside an iOS app project, so the agent should find signing inputs from the project instead of asking the user to copy settings manually.

When preparing real-device WDA, the agent should find:

- `.xcworkspace` or `.xcodeproj`
- app scheme
- `DEVELOPMENT_TEAM`
- `PRODUCT_BUNDLE_IDENTIFIER`

Do not copy the host app provisioning profile directly to WDA. WDA needs its own bundle id; derive one as `<host bundle id>.ivista.wda` unless the user provides a bundle id.

## WDA Cache

iVista manages WebDriverAgent by default.

- Default WDA repo: `https://github.com/LLLLLayer/ivista-wda.git`.
- Default cache: `~/.ivista/cache/webdriveragent/<ref>/`.
- Override with `IVISTA_WDA_REPO`, `IVISTA_WDA_REF`, or `IVISTA_HOME`.
- Use explicit `--wda-path` only for offline use, enterprise forks, or WDA debugging.

If the WDA cache looks corrupted, ask before removing it. The narrow removal command for the default ref is:

```bash
rm -rf ~/.ivista/cache/webdriveragent/ivista-wda-v0.1.1
ivista wda prepare
```

Explain that `rm -rf` recursively deletes the target path without prompting, so the path must be exact.

## Common Repair Hints

- `ivista` missing: install with `npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.24`.
- Old version: run `ivista update`.
- Xcode tools missing: install or select Xcode, then rerun `ivista doctor`.
- Real device missing: unlock the device, trust this Mac, enable Developer Mode, reconnect USB, then run `ivista device list --connected`.
- `iproxy` missing: install libimobiledevice/usbmuxd, for example `brew install libimobiledevice`.
- WDA port busy: use `ivista wda start --auto-port` or stop the old runner with `ivista wda stop --port <port>`.
- Stale WDA session: rerun the failed command; current CLI should recreate invalid sessions automatically.
