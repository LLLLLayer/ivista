# iVista Installation

Use this reference when the user asks to install, update, verify, diagnose, or repair the `ivista` CLI.

## Core Facts

- The Codex Plugin is skill-only. It does not include MCP tools.
- The plugin bundle should remain plugin-only.
- The CLI source lives outside the plugin directory in repository-level `bin/` and `src/`.
- Users install the CLI through the npm package.
- Users should not manually clone WebDriverAgent for normal use. iVista downloads and caches the pinned WDA ref automatically.

## Check Existing Install

```bash
command -v ivista
ivista version
ivista doctor
```

If `ivista doctor` reports issues, prefer following its fix hints before attempting manual repair.

## Install

Install the released CLI from the GitHub npm package source:

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.22
```

For local development from a checked-out repo:

```bash
npm install -g .
```

## Update

```bash
ivista update
```

To update from a specific branch or ref:

```bash
ivista update --ref main
```

## Verify After Install

```bash
ivista version
ivista doctor
ivista simulator list
```

If the user wants to validate the WDA cache without launching a Simulator:

```bash
ivista wda cache status
ivista wda prepare
ivista wda cache status
```

## WDA Cache

iVista manages WebDriverAgent by default.

- Default WDA repo: `https://github.com/LLLLLayer/ivista-wda.git`.
- Default cache: `~/.ivista/cache/webdriveragent/<ref>/`.
- Override with `IVISTA_WDA_REPO`, `IVISTA_WDA_REF`, or `IVISTA_HOME`.
- Use explicit `--wda-path` only for offline use, enterprise forks, or WDA debugging.

If the WDA cache looks corrupted, ask before removing it. The narrow removal command for the default ref is:

```bash
rm -rf ~/.ivista/cache/webdriveragent/ivista-wda-v0.1.1
ivista wda prepare
```

Explain that `rm -rf` recursively deletes the target path without prompting, so the path must be exact.

## Common Repair Hints

- `ivista` missing: install with `npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.22`.
- Old version: run `ivista update`.
- Xcode tools missing: install or select Xcode, then rerun `ivista doctor`.
- WDA port busy: use `ivista wda start --auto-port` or stop the old runner with `ivista wda stop --port <port>`.
- Stale WDA session: rerun the failed command; current CLI should recreate invalid sessions automatically.
