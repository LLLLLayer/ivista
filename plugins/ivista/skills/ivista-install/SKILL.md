---
name: ivista-install
description: Use this skill when the user wants to install, update, verify, diagnose, repair, or prepare iVista CLI, Xcode, iOS Simulator, WebDriverAgent cache, or real-device prerequisites such as Developer Mode, trusted device pairing, signing setup, or iproxy/libimobiledevice.
---

# iVista Install

Use this skill for setup, repair, and environment readiness. Do not use it for normal device operation after iVista is already ready; use the `ivista` skill for that.

This plugin is skill-only. It does not expose MCP tools. Use the `ivista` CLI from the shell.

## Workflow

Read [references/install.md](references/install.md), then follow only the relevant section:

- CLI install/update/version checks.
- Xcode and Simulator readiness.
- WDA cache preparation or repair.
- Real-device prerequisites: connected device, trust pairing, Developer Mode, signing inputs, and `iproxy`.

Prefer running checks before suggesting manual fixes:

```bash
command -v ivista
ivista version
ivista doctor
```

For Simulator setup:

```bash
ivista simulator list
ivista simulator boot
```

For real-device setup:

```bash
ivista device list --connected
command -v iproxy
```

## Safety

- Ask before deleting caches.
- If removing a cache, delete only the exact WDA ref directory under `~/.ivista/cache/webdriveragent/`.
- Do not ask users to clone WDA manually for normal use.
- For real devices, explain that the device must be unlocked, trusted, paired, and have Developer Mode enabled.
