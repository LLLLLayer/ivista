# Troubleshooting

[简体中文](troubleshooting.zh-CN.md)

Start with the local health check:

```bash
ivista doctor
```

When using the iVista Agent Plugin, use the `ivista-cleanup` skill for this whole flow.

## WDA Startup

If WDA does not start:

- Run `ivista wda cache status`.
- Run `ivista wda prepare` to refresh the pinned WDA checkout.
- Add `--auto-port` to the normal `ivista wda start --simulator ...` or `ivista wda start --device ...` command if port `8100` is busy.
- Use `ivista wda stop --port <port>` to clean up a stale runner.
- Pass a longer startup timeout for first builds: `--wait 180000`.

If a previous WDA runner crashed on a Simulator, terminate it and start on a fresh port:

```bash
xcrun simctl terminate booted com.facebook.WebDriverAgentRunner.xctrunner || true
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
```

## Simulator Devices

If no Simulator devices are available:

```bash
ivista simulator list --all
```

Install an iOS runtime from Xcode Settings > Platforms, then rerun:

```bash
ivista simulator list
ivista simulator boot
```

A booted Simulator means the Simulator device is already running and can be used by WDA.

## Real Devices

Before debugging signing or wireless transport, run:

```bash
ivista device list --connected
ivista device diagnose --device <device-udid>
```

If Xcode cannot build to a real device:

- Unlock the device.
- Trust this Mac on the device.
- Enable Developer Mode.
- Confirm the selected Xcode supports the device iOS version.
- Prefer running `ivista wda start` from the host iOS project so signing can be inferred.

For wireless failures, confirm `devicectl` can see the device over the local network. Use `--usb` to force USB forwarding.

## Agent Operation

When an agent is operating a device:

- Use `ivista observe --json` for checkpoints instead of separate screenshot/source/text commands.
- Use `ivista wait text`, `ivista wait gone`, `ivista wait idle`, or `ivista wait app` after actions.
- If text targeting fails, check the returned suggestions and retry with `--contains`, `--regex`, `--index`, or coordinates.

## Logs And Artifacts

iVista stores run artifacts under `~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/`.

Export a report when you need a shareable trace:

```bash
ivista run export --format markdown
ivista run export --format zip
```
