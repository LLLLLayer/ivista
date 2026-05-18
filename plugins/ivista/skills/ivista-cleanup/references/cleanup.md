# iVista Cleanup Reference

Use this reference when iVista or WDA appears stuck: a port is busy, WDA says it is running but cannot be reached, Simulator WDA crashed, or real-device forwarding is stale.

## 1. Inspect First

Start with non-destructive checks:

```bash
ivista version
ivista doctor
ivista wda status --port 8100
lsof -nP -iTCP:8100 -sTCP:LISTEN
```

If the user used `--auto-port`, ask for the printed port or inspect likely ports:

```bash
lsof -nP -iTCP -sTCP:LISTEN | rg 'WebDriverAgent|xcodebuild|iproxy|8100|8200|8300'
```

## 2. Stop WDA Through iVista

Always prefer the CLI cleanup path first:

```bash
ivista wda stop --port <port>
ivista wda status --port <port>
```

If the default port was used:

```bash
ivista wda stop --port 8100
```

Then restart on an explicit target and, if needed, a fresh port:

```bash
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
```

For real devices:

```bash
ivista device diagnose --device <device-udid>
ivista wda start --device <device-udid> --auto-port --wait 180000
```

## 3. Clean A Crashed Simulator Runner

If a Simulator shows a WDA crash dialog or WDA starts but the old runner keeps interfering:

```bash
xcrun simctl terminate booted com.facebook.WebDriverAgentRunner.xctrunner || true
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
```

If multiple Simulators are booted, use the target UDID:

```bash
xcrun simctl terminate <simulator-udid> com.facebook.WebDriverAgentRunner.xctrunner || true
ivista wda start --simulator <simulator-udid> --auto-port --wait 180000
```

## 4. Free A Busy Port

Identify the exact PID first:

```bash
lsof -nP -iTCP:<port> -sTCP:LISTEN
```

If the process is clearly an old iVista/WDA forwarding process, terminate that PID:

```bash
kill <pid>
```

If it does not exit after a short wait and it is still clearly stale:

```bash
kill -9 <pid>
```

Do not kill unrelated processes just because they use the desired port. Prefer restarting iVista with `--auto-port`.

## 5. Real-Device Forwarding

For real devices, stale forwarding is usually `iproxy` or Xcode/CoreDevice tunnel state. Inspect first:

```bash
ivista device list --connected
ivista device diagnose --device <device-udid>
ps -axo pid,command | rg 'iproxy|devicectl|WebDriverAgent|ivista'
```

Only terminate a PID that is clearly stale and tied to the affected device or port. Then restart WDA:

```bash
ivista wda start --device <device-udid> --auto-port --wait 180000
```

Use `--usb` when wireless routing is confusing:

```bash
ivista wda start --device <device-udid> --usb --auto-port --wait 180000
```

## 6. Cache Cleanup

Do not delete caches by default. If WDA source is corrupted and the user agrees, remove only the exact ref directory:

```bash
rm -rf ~/.ivista/cache/webdriveragent/<ref>
ivista wda prepare --ref <ref>
```

Never delete all of `~/.ivista` unless the user explicitly asks to reset all iVista state.

## 7. Verify Recovery

After cleanup:

```bash
ivista wda status --port <port>
ivista observe --port <port>
```

If recovery worked, tell the user the new URL/port and any process or cache that was cleaned.
