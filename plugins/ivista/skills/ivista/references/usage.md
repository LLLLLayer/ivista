# iVista Usage

Use this reference when the user asks Codex to operate a Simulator/device, start/check WDA, take screenshots, read source, perform actions, manage apps, handle alerts, or run a mobile smoke-test flow.

## Default Simulator Flow

Prefer Simulator first unless the user explicitly asks for a real device.

```bash
ivista doctor
ivista simulator list
ivista simulator boot
ivista wda start --simulator "<Simulator Name>" --auto-port
ivista wda status --port <port>
```

If there is already a booted Simulator:

```bash
ivista simulator list --booted
ivista wda status --port <port>
```

## Observe

Always observe before acting.

```bash
ivista screen shot --port <port> --output /tmp/ivista.png
ivista screen source --port <port>
```

Use screenshots for visual state. Use source for stable text, labels, coordinates, and accessibility structure.

## Common Actions

```bash
ivista act home --port <port>
ivista act tap --port <port> --x 120 --y 500
ivista act double-tap --port <port> --x 120 --y 500
ivista act two-finger-tap --port <port>
ivista act long-press --port <port> --x 120 --y 500 --duration 1
ivista act drag --port <port> --from-x 100 --from-y 600 --to-x 300 --to-y 200 --duration 0.5
ivista act pinch --port <port> --scale 0.5 --velocity -1
ivista act rotate --port <port> --rotation 1.57 --velocity 1
ivista act input "hello" --port <port>
ivista act swipe --port <port> --direction up
```

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
ivista wda start --simulator "<Simulator Name>" --auto-port
ivista wda status --port <port>
ivista wda stop --port <port>
```

Use `--auto-port` if the default port is busy or a previous WebDriverAgent runner crashed.

WDA exposes a Mac-side status URL:

```text
http://127.0.0.1:<port>/
```

That page confirms WDA is connected and links to `/status` and `/health`. It does not show a live phone screen.

## Agent Workflow

For navigation tasks:

1. Confirm WDA with `ivista wda status --port <port>`.
2. Launch the target app if needed.
3. Capture screenshot and source.
4. Use source labels and coordinates when possible.
5. Tap or gesture.
6. Re-capture screenshot/source as a checkpoint.

For smoke tests, keep a short trace of commands and save screenshots under `/tmp` so the user can inspect the result.
