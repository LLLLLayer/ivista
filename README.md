# iVista

English | [简体中文](README.zh-CN.md)

iVista is a CLI-first iOS control layer for humans and coding agents. It uses WebDriverAgent to turn an iOS Simulator or connected iPhone/iPad into an observable, scriptable test surface.

Use it when you want an agent to see the current mobile screen, wait for UI state, tap by accessibility text, type, swipe, launch apps, collect artifacts, and export a report without opening Xcode manually.

## Highlights

- Simulator and real-device workflows through one CLI.
- Automatic WebDriverAgent download, cache, start, stop, and status checks.
- One-command observation with screenshot, source, visible texts, active app, and WDA status.
- Deterministic actions: text/coordinate tap, scroll-to-text tap, double tap, two-finger tap, long press, drag, pinch, rotate, input, swipe, Home, alerts, device info, lock/unlock, hardware buttons, app launch, and app termination.
- Agent-friendly waits: text appears, text disappears, screen idle, and active app.
- Project/conversation/run artifacts under `~/.ivista`, with Markdown and zip exports.
- Skill-only plugins for Codex and Claude Code that teach agents how to install and operate the same CLI.

## Requirements

- macOS with Xcode installed.
- Xcode command line tools selected.
- Node.js 18 or newer.
- Git.
- At least one installed iOS Simulator runtime.
- For real devices: an unlocked/trusted iPhone or iPad with Developer Mode enabled. USB forwarding uses `iproxy`; wireless forwarding uses the CoreDevice tunnel exposed by Xcode/devicectl.

If Xcode tools fail, select Xcode explicitly:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Install

Install the current release:

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v1.0.7
ivista doctor
```

Update an existing install:

```bash
ivista update --ref v1.0.7
```

## Quick Start

### Simulator

```bash
ivista doctor
ivista run start --project . --conversation smoke-settings
ivista simulator list
ivista simulator boot --name "iPhone 17"
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
ivista observe --port <printed-port>
```

Drive the Simulator:

```bash
ivista act home --port <printed-port>
ivista act tap --port <printed-port> --text "Settings"
ivista act tap --port <printed-port> --text "General" --scroll
ivista wait app --port <printed-port> --bundle-id com.apple.Preferences
ivista wait idle --port <printed-port>
ivista observe --port <printed-port> --json
```

Stop WDA when you are done:

```bash
ivista wda stop --port <printed-port>
```

### Real Device

Run from your host iOS app project when possible so iVista can infer signing:

```bash
ivista doctor
ivista run start --project . --conversation real-device-smoke
ivista device list --connected
ivista device diagnose --device <device-udid>
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port --wait 180000
ivista observe --port <port>
```

If signing cannot be inferred, pass the signing inputs explicitly:

```bash
ivista wda start \
  --device <device-udid> \
  --signing-team <TEAMID> \
  --wda-bundle-id <host.bundle.id>.ivista.wda \
  --auto-port \
  --wait 180000
```

## Observation Strategy

Use `observe` when the agent needs a full checkpoint: screenshot, source XML, visible texts, active app, WDA status, and artifact paths.

```bash
ivista observe --port <port> --json
```

Good moments to observe:

- after starting WDA or launching an app;
- before a navigation step when the current screen is uncertain;
- after a page transition, alert, or important state change;
- before retrying a failed semantic action;
- before exporting a report.

For tight action sequences, prefer targeted waits instead of observing after every command:

```bash
ivista wait idle --port <port> --timeout 15000
ivista wait text "About" --port <port> --timeout 10000
ivista wait gone "Loading" --port <port> --timeout 10000
ivista wait app --bundle-id com.apple.Preferences --port <port>
```

When a semantic action cannot find text, iVista returns structured hints and candidate data so the agent can retry with `--contains`, `--regex`, `--index`, or a coordinate fallback.

## Reports And Artifacts

Artifacts are grouped by project, conversation, and run:

```text
~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/
  run.json
  events.ndjson
  artifacts/
    0001-observe-screenshot.png
    0002-observe-source.xml
    0003-observe-texts.json
~/.ivista/projects/<project-key>/conversations/<conversation-id>/exports/
  ivista-run-<run-id>.md
  ivista-run-<run-id>.zip
```

Export a report:

```bash
ivista run export --format markdown
ivista run export --format zip
```

The Markdown report includes metadata, command counts, failures, artifact links, screenshot previews, and text snapshots. The zip export includes the run directory plus `run-report.md`.

## Real Devices

iVista can start WDA on a physical iPhone/iPad over USB or a CoreDevice wireless tunnel. Run from the host iOS project when possible so signing can be inferred.

```bash
ivista device list --connected
ivista device diagnose --device <device-udid>
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port --wait 180000
ivista observe --port <port>
```

If signing cannot be inferred:

```bash
ivista wda start \
  --device <device-udid> \
  --signing-team <TEAMID> \
  --wda-bundle-id <host.bundle.id>.ivista.wda \
  --auto-port \
  --wait 180000
```

Wireless devices work when `devicectl` reports the device over the local network and exposes a CoreDevice tunnel address. Use `--usb` to force USB forwarding.

## Agent Plugins

The plugin is skill-only: it installs agent instructions, not the CLI runtime. Install the CLI separately first.

Codex:

```bash
codex plugin marketplace add LLLLLayer/ivista
```

Then open Codex, go to the plugin marketplace, and install `iVista`. To pin a release:

```bash
codex plugin marketplace add LLLLLayer/ivista --ref v1.0.7
```

Claude Code:

```text
/plugin marketplace add LLLLLayer/ivista
/plugin install ivista@ivista
```

Local Claude Code testing:

```bash
claude --plugin-dir ./plugins/ivista
```

Claude Code skill names:

```text
/ivista:ivista-install
/ivista:ivista-operate
/ivista:ivista-cleanup
/ivista:ivista-report
```

## CLI Reference

The README keeps only the getting-started path. See [docs/cli.md](docs/cli.md) for the full command reference, examples, and common options. A Chinese version is available at [docs/cli.zh-CN.md](docs/cli.zh-CN.md).

## WebDriverAgent

iVista manages WebDriverAgent automatically. Users should not clone WDA manually for the default path.

Defaults:

- WDA repo: `https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref: `ivista-wda-v1.0.0`
- iVista home: `~/.ivista`
- WDA cache: `~/.ivista/cache/webdriveragent/<ref>/`
- WDA port: `8100`

The CLI pins a known-good WDA ref. The WDA fork evolves independently and is downloaded into the local cache at runtime.

Override WDA only when needed:

```bash
ivista wda prepare --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v1.0.0
ivista wda start --simulator "iPhone 17" --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v1.0.0
ivista wda start --simulator "iPhone 17" --wda-path ./ivista-wda
```

## Configuration

- `IVISTA_HOME`: overrides the iVista cache/session/log directory.
- `IVISTA_WDA_REPO`: overrides the WebDriverAgent Git repository.
- `IVISTA_WDA_REF`: overrides the WebDriverAgent Git ref.
- `IVISTA_WDA_PORT`: overrides the default WDA port.
- `IVISTA_WDA_BASE_URL`: connects to an already-running WDA endpoint.

Example:

```bash
IVISTA_WDA_PORT=8200 ivista wda start --simulator "iPhone 17"
IVISTA_WDA_BASE_URL=http://127.0.0.1:8200 ivista observe
```

## More Docs

- [CLI Reference](docs/cli.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Development](docs/development.md)

## License And Open Source Usage

iVista is released under the [MIT License](LICENSE).

The CLI does not vendor WebDriverAgent into this repository's npm package, Codex plugin bundle, or Claude Code plugin bundle. By default, iVista downloads a pinned WDA fork at runtime:

- WDA repo: `https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref: `ivista-wda-v1.0.0`
- Cache path: `~/.ivista/cache/webdriveragent/<ref>/`

The WDA fork is an independent open-source project with its own license and third-party notices. iVista also calls local tools such as Xcode, `xcodebuild`, `xcrun simctl`, Git, Node.js, and npm; those tools are not distributed with iVista and remain governed by their own licenses.
