# iVista CLI Reference

[简体中文](cli.zh-CN.md)

This document is the public command reference for iVista. The README keeps the quick-start path; this file keeps the fuller command list and examples.

## Global

```bash
ivista version
ivista update [--ref main]
ivista doctor [--json]
ivista --help
```

- `version`: prints the installed CLI version.
- `update`: updates a Git-installed CLI to the selected ref.
- `doctor`: checks local dependencies, Xcode tools, Simulator support, WDA cache, and common fix hints.
- `--json`: prints machine-readable output for commands that support it.

## Runs And Reports

Use run metadata when an agent is operating an app and you want screenshots, source dumps, actions, and exports to be grouped by project and conversation.

```bash
ivista run start [--project .] [--conversation <id>] [--run <id>] [--title <title>]
ivista run current [--json]
ivista run export [--format markdown|zip] [--output report.md]
```

Default artifact layout:

```text
~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/
  run.json
  events.ndjson
  artifacts/
~/.ivista/projects/<project-key>/conversations/<conversation-id>/exports/
```

## Simulator

```bash
ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
ivista simulator boot
ivista simulator boot 1
ivista simulator boot --name "iPhone 17"
ivista simulator boot --udid <simulator-udid>
```

- `simulator list`: shows a compact deduped list by default.
- `--all`: shows all runtimes and duplicated device entries.
- `--booted`: only shows running Simulators.
- `simulator boot`: opens an interactive picker. Use Up/Down and Enter.
- `simulator boot 1`: boots by the displayed row number.

## Real Devices

```bash
ivista device list [--connected] [--json]
ivista device diagnose [--device <device-udid>] [--port 8100]
ivista device info
ivista device battery
ivista device lock
ivista device unlock
ivista device locked
ivista device press --name volumeUp
```

Use `device diagnose` when real-device WDA startup or wireless routing is unclear. It checks device discovery, tunnel hints, WDA reachability, and likely signing or transport issues.

## WebDriverAgent

```bash
ivista wda cache status
ivista wda list
ivista wda prepare [--ref ivista-wda-v1.0.0]
ivista wda start --simulator "iPhone 17" [--port 8100]
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port
ivista wda stop [--port 8100]
ivista wda status [--port 8100]
ivista cleanup [--port 8100]
```

Simulator example:

```bash
ivista simulator boot --name "iPhone 17"
ivista wda prepare
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
ivista wda status --port <port>
```

Real-device example:

```bash
ivista device list --connected
ivista wda start \
  --device <device-udid> \
  --workspace MyApp.xcworkspace \
  --scheme MyApp \
  --auto-port \
  --wait 180000
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

## Observe And Screen

```bash
ivista observe [--port 8100]
ivista screen shot [--port 8100] [--output ~/.ivista/screenshot.png]
ivista screen source [--port 8100]
ivista screen texts [--port 8100]
```

- `observe`: captures a checkpoint with screenshot, source, text summary, active app, and saved artifacts.
- `screen shot`: captures a PNG screenshot. Without `--output`, it prints base64 metadata.
- `screen source`: prints WDA page source XML.
- `screen texts`: extracts visible Accessibility text from source XML.

Use `observe` at decision points, before risky actions, after navigation, and when exporting a report. For tight action chains, prefer targeted waits.

## Waits

```bash
ivista wait text "Wi-Fi" [--port 8100] [--timeout 10000]
ivista wait gone "Loading" [--port 8100] [--timeout 10000]
ivista wait idle [--port 8100] [--stable-ms 1000] [--poll-ms 500]
ivista wait app --bundle-id com.apple.Preferences [--port 8100]
```

- `wait text`: waits until matching Accessibility text appears.
- `wait gone`: waits until matching text disappears.
- `wait idle`: waits until source snapshots stay stable for the configured duration.
- `wait app`: waits until the foreground app matches a bundle id.

Text matching can use exact text, contains, or regex:

```bash
ivista wait text --contains "Language"
ivista wait text --regex "Wi-?Fi"
```

## Actions

```bash
ivista act home [--port 8100]
ivista act tap --x 120 --y 500
ivista act tap --text "Wi-Fi"
ivista act tap --contains "Language"
ivista act tap --text "Language & Region" --scroll
ivista act double-tap --x 120 --y 500
ivista act double-tap --text "Photos"
ivista act two-finger-tap
ivista act long-press --x 120 --y 500 [--duration 1]
ivista act long-press --text "App" [--duration 1]
ivista act drag --from-x 100 --from-y 600 --to-x 300 --to-y 200 [--duration 0.5]
ivista act pinch --scale 0.5 --velocity -1
ivista act rotate --rotation 1.57 --velocity 1
ivista act input "hello"
ivista act swipe --direction up
```

Text actions resolve against WDA Accessibility source. When a text target is not found, iVista prints nearby suggestions so an agent can adjust the next command.

## Keyboard And Alerts

```bash
ivista keyboard dismiss

ivista alert accept [--name OK]
ivista alert dismiss [--name Cancel]
ivista alert text
ivista alert input "hello"
ivista alert buttons
```

Use alert commands for system permission prompts and modal alerts exposed by WDA.

## Apps

```bash
ivista app launch --bundle-id com.example.app
ivista app terminate --bundle-id com.example.app
```

## Common Options

- `--json`: print raw JSON.
- `--simulator <name|udid>`: target Simulator name or UDID.
- `--device <name|udid>`: target physical iOS device name or UDID.
- `--bundle-id <id>`: app bundle identifier.
- `--base-url <url>`: override the WDA base URL.
- `--port <port>`: WDA port, defaulting to `8100`.
- `--auto-port`: find an available WDA port automatically.
- `--scroll`, `--max-scrolls <n>`, `--scroll-direction <up|down|left|right>`: scroll while searching for text actions.
- `--project <path>`, `--conversation <id>`, `--run <id>`, `--title <title>`: set run metadata.
- `--workspace`, `--ios-project`, `--scheme`, `--signing-team`, `--wda-bundle-id`: real-device signing inputs.
- `--network`, `--usb`: force real-device transport mode.
- `--text <text>`, `--contains <text>`, `--regex <pattern>`, `--index <n>`: match Accessibility `name`, `label`, or `value`.
- `--stable-ms <ms>`, `--poll-ms <ms>`: tune wait and idle polling.
- `--wda-path <path>`, `--repo <url>`, `--ref <ref>`: override WDA source.
- `--timeout <ms>`, `--wait <ms>`: tune command and WDA startup timeouts.

## Notes For Agents

- Prefer `observe` when you need a reliable checkpoint or report evidence.
- Prefer `wait text`, `wait gone`, `wait idle`, or `wait app` after an action instead of sleeping.
- Use `--json` when feeding results into another tool or model step.
- Keep WDA on one port per target device, and use `--auto-port` when multiple targets may run together.
