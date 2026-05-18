# iVista Usage

Use this reference when the user asks Codex to operate a target iOS device, start/check WDA, take screenshots, read source, perform actions, manage apps, handle alerts, or run a mobile smoke-test flow.

## Pick The Target

Use the user's requested target:

- Real device: user says iPhone, iPad, physical device, real device, USB, wireless, connected device, signing, Developer Mode, or provides a real-device UDID.
- Simulator device: user says Simulator, simulated device, or booted Simulator.

Do not answer a real-device request with Simulator commands. For real devices, go directly to [Real Device Flow](#real-device-flow).

If the user does not specify a target, inspect availability before choosing:

```bash
ivista device list --connected
ivista simulator list --booted
```

If exactly one connected real device is visible and `ivista device diagnose --device <device-udid>` looks usable, it is acceptable to try a limited real-device path for non-destructive validation, especially when the task sounds like physical-device validation. If real-device signing or transport looks fragile, fall back to the Simulator device path or ask for the target when the choice affects the result.

## Operation Strategy

Default to `auto`: vision-first, Accessibility-fallback.

In `auto`, treat the screenshot as the source of truth for what is visibly on screen. Do not start normal operation with `act tap --text`, `screen texts`, or `screen source`. Use coordinates when the visual target is clear. Use Accessibility source/texts only after the visual route is ambiguous, fails, or the user explicitly asks for text/label-based operation.

Use `vision-first` when the user asks to operate by sight, screenshot, visual target, coordinates, or says not to rely on Accessibility. In this mode, observe, inspect the screenshot, calculate the target point, act by coordinates or gestures, then observe or wait again.

Use `accessibility-first` when the user asks to tap by text, use Accessibility, avoid coordinates, or operate by labels. In this mode, prefer `screen texts`, `wait text`, `wait gone`, and semantic actions such as `act tap --text`, `--contains`, or `--regex`.

Accessibility/source/text lookups default to 5 seconds. Keep examples at `--timeout 5000`, and only use longer waits for real loading states.

## Simulator Device Flow

Use this when the user asks for a Simulator device, or when no usable real device is available after target discovery.

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

The Markdown report contains metadata, command counts, failures, screenshot previews, and accessibility text snapshots. The zip export includes the run folder plus `run-report.md`.

If there is already a booted Simulator device:

```bash
ivista simulator list --booted
ivista wda status --port <port>
```

## Observe

Observe before acting when the current screen is uncertain or when the next action depends on UI state. Prefer the single checkpoint command:

```bash
ivista observe --port <port>
```

`observe` is screenshot-first. It captures a screenshot artifact, WDA status, and active app info into the current run directory. It also tries to capture source and visible text snapshots with a short Accessibility timeout; if source is slow or broken, `observe` still succeeds with the screenshot and reports the source error. Use `--json` when an Agent needs artifact paths.

Use lower-level reads only when needed:

```bash
ivista screen shot --port <port>
ivista screen source --port <port>
ivista screen texts --port <port>
```

## Common Actions

```bash
ivista act home --port <port>
ivista act tap --port <port> --x 120 --y 500
ivista act tap --port <port> --text "Wi-Fi" --timeout 5000
ivista act tap --port <port> --contains "Language" --timeout 5000
ivista act double-tap --port <port> --x 120 --y 500
ivista act double-tap --port <port> --text "Photos" --timeout 5000
ivista act two-finger-tap --port <port>
ivista act long-press --port <port> --x 120 --y 500 --duration 1
ivista act long-press --port <port> --text "App" --duration 1 --timeout 5000
ivista act drag --port <port> --from-x 100 --from-y 600 --to-x 300 --to-y 200 --duration 0.5
ivista act pinch --port <port> --scale 0.5 --velocity -1
ivista act rotate --port <port> --rotation 1.57 --velocity 1
ivista act input "hello" --port <port>
ivista act swipe --port <port> --direction up
ivista wait text "Done" --port <port> --timeout 5000
ivista wait gone "Loading" --port <port> --timeout 5000
ivista wait idle --port <port> --stable-ms 1000 --timeout 5000
ivista wait app --port <port> --bundle-id com.example.app --timeout 5000
```

In the default `auto` strategy, observe first, use the screenshot to decide what should happen, and tap by coordinates when the visual target is clear. Use `--text`, `--contains`, or `--regex` only after the visual route is ambiguous or fails, or when the user asks for text/label-based operation. Use coordinates when the app is a game, canvas, custom-rendered screen, icon-heavy view, complex feed, or has poor accessibility labels. Use `--index <n>` when multiple elements match.

Text matching is normalized for case and whitespace. When several elements match, iVista prefers visible, enabled, accessible, smaller interactive elements over broad containers; still inspect candidates when the first match is not the intended target. When text is not found, failed semantic actions return nearby candidates and fix hints. Use those candidates to retry with `--contains`, `--regex`, or `--index`.

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

With a single booted Simulator device, `wda start` can infer the target. For real devices, pass `--device <device-udid>`. Use `--simulator`, `--name`, or `--udid` when multiple Simulator devices are booted. Use `--auto-port` if the default port is busy or a previous WebDriverAgent runner crashed.

WDA exposes a Mac-side status URL:

```text
http://127.0.0.1:<port>/
```

That page confirms WDA is connected and links to `/status` and `/health`. It does not show a live phone screen.

## Real Device Flow

Use this when the user asks for a real iPhone/iPad, connected device, physical device, USB, wireless, or provides a real-device UDID. Prefer finding signing settings from the user's current iOS project instead of asking them to open Xcode manually.

Start by discovering the device:

```bash
ivista device list --connected
ivista device diagnose --device <device-udid>
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
- Wireless is supported when `ivista device diagnose --device <udid>` reports `wireless CoreDevice tunnel` as OK; iVista will talk to WDA through that CoreDevice tunnel directly. Use `--usb` to force USB `iproxy` forwarding.
- Xcode can build to the device with the selected team.
- `iproxy` is installed and available in PATH for USB forwarding.
- First launch may require a longer `--wait` because Xcode may create provisioning assets.

## Observation Strategy

For navigation tasks:

1. Confirm WDA with `ivista wda status --port <port>`.
2. Launch the target app if needed.
3. Run `ivista observe --port <port> --json` when the current screen is uncertain or when a full checkpoint is useful.
4. In the default `auto` strategy, inspect the screenshot first and avoid Accessibility selectors unless the visual route is ambiguous, failed, or explicitly requested.
5. Prefer `wait idle`, `wait text`, `wait gone`, or `wait app` for tight action sequences.
6. Tap or gesture by coordinates for visual-only controls, and by semantic selectors for stable text/label controls.
7. Observe again after page transitions, alert handling, important state changes, failed semantic actions, or before exporting a report.

For smoke tests, start an iVista run first and let `observe` store important checkpoints in `~/.ivista/projects/...`; avoid ad-hoc `/tmp` files unless the user asks for a specific output path.
