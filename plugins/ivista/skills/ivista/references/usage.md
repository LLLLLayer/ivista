# iVista Usage

Use this reference when the user asks Codex to operate a Simulator/device, start/check WDA, take screenshots, read source, perform actions, manage apps, handle alerts, or run a mobile smoke-test flow.

## Default Simulator Flow

Prefer Simulator first unless the user explicitly asks for a real device.

```bash
ivista doctor
ivista run start --project . --conversation <conversation-id>
ivista simulator list
ivista simulator boot
ivista wda start --auto-port
ivista wda status --port <port>
```

Start a run before operating the device whenever possible. If the agent cannot access a real conversation id, use a stable task name. iVista stores screenshots, source, texts, and command events under `~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/`.

At the end of a flow, export the run when the user wants a report or shareable debug bundle:

```bash
ivista run export --format markdown
ivista run export --format zip
```

If there is already a booted Simulator:

```bash
ivista simulator list --booted
ivista wda status --port <port>
```

## Observe

Always observe before acting.

```bash
ivista screen shot --port <port>
ivista screen source --port <port>
ivista screen texts --port <port>
```

Use screenshots for visual state. Use `screen texts` before semantic actions, and use source for deeper labels, coordinates, and accessibility structure.

## Common Actions

```bash
ivista act home --port <port>
ivista act tap --port <port> --x 120 --y 500
ivista act tap --port <port> --text "Wi-Fi"
ivista act tap --port <port> --contains "Language"
ivista act double-tap --port <port> --x 120 --y 500
ivista act double-tap --port <port> --text "Photos"
ivista act two-finger-tap --port <port>
ivista act long-press --port <port> --x 120 --y 500 --duration 1
ivista act long-press --port <port> --text "App" --duration 1
ivista act drag --port <port> --from-x 100 --from-y 600 --to-x 300 --to-y 200 --duration 0.5
ivista act pinch --port <port> --scale 0.5 --velocity -1
ivista act rotate --port <port> --rotation 1.57 --velocity 1
ivista act input "hello" --port <port>
ivista act swipe --port <port> --direction up
ivista wait text "Done" --port <port> --timeout 10000
```

Prefer `--text`, `--contains`, or `--regex` when the target appears in Accessibility. Use coordinates when the app is a game, canvas, custom-rendered screen, or has poor accessibility labels. Use `--index <n>` when multiple elements match.

## Keyboard, Alerts, Device

```bash
ivista keyboard dismiss --port <port>
ivista alert buttons --port <port>
ivista alert text --port <port>
ivista alert accept --port <port>
ivista alert dismiss --port <port>
ivista alert input "hello" --port <port>
ivista device info --port <port>
ivista device battery --port <port>
ivista device locked --port <port>
ivista device lock --port <port>
ivista device unlock --port <port>
ivista device press --port <port> --name volumeUp
```

## Apps

```bash
ivista app launch --port <port> --bundle-id com.example.app
ivista app terminate --port <port> --bundle-id com.example.app
```

For Settings:

```bash
ivista app launch --port <port> --bundle-id com.apple.Preferences
```

## WDA Management

```bash
ivista wda cache status
ivista wda prepare
ivista wda start --auto-port
ivista wda status --port <port>
ivista wda stop --port <port>
```

With a single booted Simulator, `wda start` can infer the target. Use `--simulator`, `--name`, or `--udid` when multiple Simulators are booted. Use `--auto-port` if the default port is busy or a previous WebDriverAgent runner crashed.

WDA exposes a Mac-side status URL:

```text
http://127.0.0.1:<port>/
```

That page confirms WDA is connected and links to `/status` and `/health`. It does not show a live phone screen.

## Real Device Flow

Use this only when the user explicitly asks for a real iPhone/iPad. Prefer finding signing settings from the user's current iOS project instead of asking them to open Xcode manually.

Start by discovering the device:

```bash
ivista device list --connected
```

Then inspect the current project directory when the target project is not obvious. The CLI can also infer a single nearby `.xcworkspace` or `.xcodeproj` from the current directory or a parent directory.

```bash
find . -maxdepth 2 \( -name "*.xcworkspace" -o -name "*.xcodeproj" \)
xcodebuild -list -json -workspace <App.xcworkspace>
xcodebuild -list -json -project <App.xcodeproj>
```

Choose the app workspace/project and app scheme. Prefer `.xcworkspace` when both workspace and project exist. If there is exactly one obvious app scheme, use it; if there are multiple plausible app schemes, ask the user which app target to use.

Read signing from the host app:

```bash
xcodebuild -showBuildSettings -json -workspace <App.xcworkspace> -scheme <AppScheme> -configuration Debug -destination 'generic/platform=iOS'
```

Extract:

- `DEVELOPMENT_TEAM`
- `PRODUCT_BUNDLE_IDENTIFIER`
- `CODE_SIGN_STYLE`

Do not copy the host app provisioning profile directly to WDA. WDA needs its own bundle id. Derive one from the host app bundle id unless the user provides one:

```text
<host bundle id>.ivista.wda
```

Start WDA on the real device:

```bash
ivista wda start \
  --device <device-udid> \
  --workspace <App.xcworkspace> \
  --scheme <AppScheme> \
  --wda-bundle-id <host.bundle.id>.ivista.wda \
  --auto-port \
  --wait 180000
```

For `.xcodeproj` projects:

```bash
ivista wda start \
  --device <device-udid> \
  --ios-project <App.xcodeproj> \
  --scheme <AppScheme> \
  --wda-bundle-id <host.bundle.id>.ivista.wda \
  --auto-port \
  --wait 180000
```

`ivista wda start` reuses an already reachable WDA on the requested port. If the port is occupied by something else, prefer retrying with `--auto-port` or running `ivista wda stop`.

If project introspection fails but the team id is known, pass it explicitly:

```bash
ivista wda start --device <device-udid> --signing-team <TEAMID> --wda-bundle-id <host.bundle.id>.ivista.wda --auto-port --wait 180000
```

Real-device prerequisites:

- Device is connected, unlocked, paired/trusted, and Developer Mode is enabled.
- Wireless is supported when `ivista device list --connected --json` shows `transportType` as `localNetwork` and a `tunnelIPAddress`; iVista will talk to WDA through the CoreDevice tunnel directly. Use `--usb` to force USB `iproxy` forwarding.
- Xcode can build to the device with the selected team.
- `iproxy` is installed and available in PATH for USB forwarding.
- First launch may require a longer `--wait` because Xcode may create provisioning assets.

## Agent Workflow

For navigation tasks:

1. Confirm WDA with `ivista wda status --port <port>`.
2. Launch the target app if needed.
3. Capture screenshot and source.
4. Use source labels and coordinates when possible.
5. Tap or gesture.
6. Re-capture screenshot/source as a checkpoint.

For smoke tests, keep a short trace of commands and save screenshots under `/tmp` so the user can inspect the result.
