# iVista

English | [简体中文](README.zh-CN.md)

iVista is a CLI-first control layer for iOS Simulator and real-device testing through WebDriverAgent. It gives humans and coding agents the same shell interface for observing, starting, and operating iOS test surfaces.

In one sentence: iVista turns an iOS Simulator or connected iPhone into an agent-operable mobile test surface.

## What Works Today

- Check local Xcode, `simctl`, Git, and iVista cache readiness.
- List and boot iOS Simulators.
- List connected physical iOS devices.
- Download and cache a pinned iVista WebDriverAgent fork automatically.
- Start, stop, and check WebDriverAgent.
- Start real-device WDA over USB or a CoreDevice wireless tunnel by reusing signing settings from a host iOS app project.
- Capture screenshots and accessibility/source trees.
- Run deterministic WDA actions: tap, double tap, two-finger tap, long press, drag, pinch, rotate, type, swipe, Home, keyboard dismiss, alerts, device info, device lock/unlock, hardware button press, app launch, and app termination.
- Provide a skill-only Codex plugin that teaches agents how to install and call the same `ivista` CLI.

The current implementation supports Simulator workflows plus verified USB and CoreDevice wireless real-device WDA paths. Richer reports, recipes, and app hooks are planned in [docs/iVista-planning.md](docs/iVista-planning.md).

## Requirements

- macOS with Xcode installed.
- Xcode command line tools selected.
- Node.js 18 or newer.
- Git.
- At least one installed iOS Simulator runtime.
- For real devices: a trusted/unlocked iPhone or iPad with Developer Mode enabled. USB forwarding needs `iproxy` from libimobiledevice; wireless forwarding uses the CoreDevice tunnel exposed by Xcode/devicectl.

If Xcode tools fail, select Xcode explicitly:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Installation

Install the latest tagged CLI from this repository:

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.25
ivista doctor
```

Update an existing global install:

```bash
ivista update --ref v0.1.25
```

For local development from this checkout:

```bash
npm install -g .
ivista version
```

## Quick Start

```bash
ivista doctor
ivista simulator list
ivista simulator boot --name "iPhone 17"
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
ivista screen shot --output /tmp/ivista.png
ivista screen source
```

Once WDA is running, drive the Simulator:

```bash
ivista act home
ivista act tap --x 120 --y 500
ivista act input "hello from ivista"
ivista act swipe --direction up
ivista app launch --bundle-id com.apple.Preferences
ivista app terminate --bundle-id com.apple.Preferences
```

Stop WDA when you are done:

```bash
ivista wda stop
```

Most commands support `--json` for agent-friendly output:

```bash
ivista simulator list --json
ivista wda status --json
ivista screen shot --json
```

## CLI Reference

```bash
ivista version
ivista update [--ref main]
ivista doctor [--json]

ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
ivista simulator boot
ivista simulator boot 1
ivista simulator boot --name "iPhone 17"
ivista simulator boot --udid <simulator-udid>
ivista device list [--connected] [--json]

ivista wda cache status
ivista wda prepare [--ref ivista-wda-v0.1.1]
ivista wda start [--auto-port]
ivista wda start --simulator "iPhone 17" [--port 8100]
ivista wda start --simulator "iPhone 17" --auto-port
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port
ivista wda stop [--port 8100]
ivista wda status [--port 8100]

ivista screen shot [--port 8100] [--output /tmp/ivista.png]
ivista screen source [--port 8100]

ivista act home [--port 8100]
ivista act tap --x 120 --y 500
ivista act double-tap --x 120 --y 500
ivista act two-finger-tap
ivista act long-press --x 120 --y 500 [--duration 1]
ivista act drag --from-x 100 --from-y 600 --to-x 300 --to-y 200 [--duration 0.5]
ivista act pinch --scale 0.5 --velocity -1
ivista act rotate --rotation 1.57 --velocity 1
ivista act input "hello"
ivista act swipe --direction up

ivista keyboard dismiss

ivista alert accept [--name OK]
ivista alert dismiss [--name Cancel]
ivista alert text
ivista alert input "hello"
ivista alert buttons

ivista device lock
ivista device unlock
ivista device locked
ivista device info
ivista device battery
ivista device press --name volumeUp

ivista app launch --bundle-id com.example.app
ivista app terminate --bundle-id com.example.app
```

Useful options:

- `--json`: print raw JSON.
- `--simulator <name|udid>`: target Simulator name or UDID.
- `--device <name|udid>`: target physical iOS device name or UDID.
- `--name <name>`: Simulator name.
- `--udid <udid>`: target UDID.
- `--bundle-id <id>`: app bundle identifier.
- `--base-url <url>`: override the WDA base URL.
- `--port <port>`: WDA port, defaulting to `8100`.
- `--auto-port`: find an available WDA port automatically.
- `--workspace`, `--ios-project`, `--scheme`, `--signing-team`, and `--wda-bundle-id`: real-device WDA signing inputs.
- `--network` and `--usb`: force the real-device transport mode. By default iVista uses the CoreDevice tunnel when `devicectl` reports `transportType=localNetwork`.
- `--output <path>`: save command output, currently used by screenshots.
- `--duration <seconds>`: gesture duration.
- `--scale <number>` and `--velocity <number>`: pinch parameters.
- `--rotation <radians>`: rotate gesture amount.
- `--key-names <names>`: comma-separated keyboard dismissal key names.
- `--wda-path <path>`: use an explicit local WebDriverAgent project.
- `--repo <url>` and `--ref <ref>`: override the WDA Git source.
- `--timeout <ms>` and `--wait <ms>`: tune command and WDA startup timeouts.

## WebDriverAgent Management

iVista manages WebDriverAgent automatically. Users should not clone WDA manually for the default path.

`ivista wda start` is stateful: it first checks whether WDA is already reachable on the requested port and reuses it when possible. If the port is occupied by something else, it returns a fix hint instead of waiting on a doomed `xcodebuild`.

Defaults:

- WDA repo: `https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref: `ivista-wda-v0.1.1`
- iVista home: `~/.ivista`
- WDA cache: `~/.ivista/cache/webdriveragent/<ref>/`
- WDA port: `8100`

The default WDA ref is a pinned tag from the `ivista-wda` fork. CLI versions and WDA versions are independent: the CLI pins a known-good WDA ref, while the WDA fork can evolve on its own `develop` branch and publish new tags.

Override WDA only when needed:

```bash
ivista wda prepare --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v0.1.1
ivista wda start --simulator "iPhone 17" --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v0.1.1
```

Use `--wda-path` for offline work, enterprise forks, or debugging WDA itself:

```bash
ivista wda start --simulator "iPhone 17" --wda-path ./ivista-wda
```

For real devices, run from the host iOS project when possible so iVista can infer signing:

```bash
ivista device list --connected
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port --wait 180000
```

If signing cannot be inferred, pass `--signing-team <TEAMID>` and optionally `--wda-bundle-id <bundle-id>`.

Wireless devices are supported when Xcode/devicectl already sees the device over the local network and exposes a CoreDevice tunnel address. iVista detects `transportType=localNetwork` and talks to WDA through that tunnel directly. Use `--usb` to force USB `iproxy` forwarding.

Verified real-device examples:

```bash
# USB path
ivista wda start --device <device-udid> --usb --signing-team <TEAMID> --wda-bundle-id <bundle-id> --auto-port --wait 180000

# Wireless path through the CoreDevice tunnel
ivista device list --connected --json
ivista wda start --device <device-udid> --network --signing-team <TEAMID> --wda-bundle-id <bundle-id> --port 8211 --wait 180000
ivista screen shot --port 8211 --output /tmp/ivista.png
ivista screen source --port 8211
```

When WDA is started through the CoreDevice tunnel, follow-up commands can still use the logical `--port`; iVista resolves it to the saved tunnel URL internally.

## Configuration

iVista reads these environment variables:

- `IVISTA_HOME`: overrides the iVista cache/session/log directory.
- `IVISTA_WDA_REPO`: overrides the WebDriverAgent Git repository.
- `IVISTA_WDA_REF`: overrides the WebDriverAgent Git ref.
- `IVISTA_WDA_PORT`: overrides the default WDA port.
- `IVISTA_WDA_BASE_URL`: connects to an already-running WDA endpoint.

Example:

```bash
IVISTA_WDA_PORT=8200 ivista wda start --simulator "iPhone 17"
IVISTA_WDA_BASE_URL=http://127.0.0.1:8200 ivista screen shot
```

## Codex Plugin

This repository includes a skill-only Codex plugin at [plugins/ivista](plugins/ivista). It does not expose MCP tools. It teaches Codex when and how to install and call the `ivista` CLI.

The plugin directory is intentionally thin:

- [plugins/ivista/.codex-plugin/plugin.json](plugins/ivista/.codex-plugin/plugin.json): plugin manifest.
- [plugins/ivista/README.md](plugins/ivista/README.md): plugin-specific usage notes.
- [plugins/ivista/skills/ivista-install/SKILL.md](plugins/ivista/skills/ivista-install/SKILL.md): install and environment repair instructions.
- [plugins/ivista/skills/ivista/SKILL.md](plugins/ivista/skills/ivista/SKILL.md): device operation instructions.

The CLI implementation lives outside the plugin bundle:

- [bin/ivista.mjs](bin/ivista.mjs): CLI entrypoint.
- [src/ivista-runtime.mjs](src/ivista-runtime.mjs): tool registry and runtime dispatcher.
- [src/core.mjs](src/core.mjs), [src/devices.mjs](src/devices.mjs), [src/wda.mjs](src/wda.mjs), [src/actions.mjs](src/actions.mjs), [src/sessions.mjs](src/sessions.mjs), and [src/doctor.mjs](src/doctor.mjs): focused runtime modules.

## Development

Install and run checks:

```bash
npm install
npm run check
npm run doctor
```

Run the CLI directly from the repo:

```bash
node bin/ivista.mjs version
node bin/ivista.mjs simulator list
```

For local WDA development, keep the WDA fork next to the CLI source:

```text
ivista/
  ivista-wda/  # ignored by the outer iVista repo
```

`ivista-wda/` is a separate Git checkout of `git@github.com:LLLLLayer/ivista-wda.git`. It is ignored by this repository and should be developed, branched, tagged, and pushed as its own repo.

## Project Layout

```text
.
├── bin/
│   └── ivista.mjs
├── src/
│   ├── actions.mjs
│   ├── core.mjs
│   ├── devices.mjs
│   ├── doctor.mjs
│   ├── ivista-runtime.mjs
│   ├── sessions.mjs
│   └── wda.mjs
├── docs/
│   └── iVista-planning.md
├── plugins/
│   └── ivista/
│       ├── .codex-plugin/
│       │   └── plugin.json
│       ├── README.md
│       └── skills/
│           ├── ivista-install/
│           │   └── SKILL.md
│           └── ivista/
│               └── SKILL.md
├── .agents/
│   └── plugins/
│       └── marketplace.json
├── package.json
├── LICENSE
├── README.md
└── README.zh-CN.md
```

## Current Scope And Limitations

- Simulator support is the primary working path.
- Real-device support works for local USB and CoreDevice wireless WDA paths, but is not yet a full one-command bootstrap flow for every signing, trust, and device state.
- iVista performs deterministic WDA actions; it does not include a built-in vision planner.
- Recipes, report generation, app debug hooks, Midscene adapters, and device-farm style execution are planned but not part of the current CLI surface.
- Simulator validation is fast and useful, but it is not a complete substitute for real-device testing.

## License

iVista is released under the [MIT License](LICENSE).

## Open Source Software Usage

iVista itself is licensed under MIT. The CLI does not vendor WebDriverAgent into this repository's npm package or Codex plugin bundle.

By default, iVista downloads a pinned WDA fork at runtime:

- WDA repo: `https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref: `ivista-wda-v0.1.1`
- Cache path: `~/.ivista/cache/webdriveragent/<ref>/`

The WDA fork is an independent open-source project with its own license and third-party notices. If you distribute a customized WDA source tree or binary, keep the license and vendor notices from the WDA repository.

iVista also calls local tools such as Xcode, `xcodebuild`, `xcrun simctl`, Git, Node.js, and npm. These tools are not distributed with iVista and remain governed by their own licenses.
