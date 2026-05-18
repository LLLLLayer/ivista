---
name: ivista-cleanup
description: Use this skill when the user wants Codex to clean up a stuck or stale iVista environment, including dead WDA ports, stale WebDriverAgent runners, crashed Simulator WDA sessions, leftover iproxy forwarding, busy ports, or confusing local iVista state after failed starts.
---

# iVista Cleanup

Use this skill to recover a local iVista environment when WDA, ports, Simulator sessions, or real-device forwarding are stuck.

This plugin is skill-only. It does not expose MCP tools. Use shell commands and the `ivista` CLI.

## Workflow

Read [references/cleanup.md](references/cleanup.md), then follow the smallest relevant cleanup path:

- Check the current CLI and WDA status.
- Stop known iVista/WDA sessions with `ivista wda stop`.
- Inspect busy ports before killing anything.
- Clean Simulator WDA runner state when WDA crashed on a Simulator.
- Clean real-device forwarding only when the process is clearly tied to iVista/WDA.
- Re-verify with `ivista wda status`, `ivista device diagnose`, or a fresh `ivista wda start`.

## Default Checks

```bash
ivista version
ivista doctor
ivista wda status --port 8100
lsof -nP -iTCP:8100 -sTCP:LISTEN
```

## Safety

- Prefer `ivista wda stop --port <port>` before process-level cleanup.
- Do not run broad commands like `killall node`, `killall xcodebuild`, or `rm -rf ~/.ivista`.
- Kill only exact PIDs that were just identified as stale iVista/WDA-related processes.
- Ask before deleting caches or run artifacts.
- If a real device is involved, prefer `ivista device diagnose --device <udid>` before changing forwarding state.
