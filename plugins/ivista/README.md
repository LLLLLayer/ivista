# iVista Agent Plugin

iVista is a CLI-first plugin for iOS Simulator and WebDriverAgent control. The plugin contributes skills that tell Codex or Claude Code how to install and use the `ivista` CLI.

This directory is intentionally plugin-only: `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, skills, and plugin docs. The CLI implementation lives at the repository root in `bin/` and `src/`, and is installed through the npm package.

## Host Support

- Codex reads `.codex-plugin/plugin.json`.
- Claude Code reads `.claude-plugin/plugin.json` and discovers the shared `skills/` directory.
- Both hosts use the same `ivista-install`, `ivista-operate`, and `ivista-report` skill content.

For local Claude Code testing from this repository:

```bash
claude --plugin-dir ./plugins/ivista
```

For repository-level Claude Code marketplace testing, use the root `.claude-plugin/marketplace.json`:

```text
/plugin marketplace add .
/plugin install ivista@ivista
```

The Claude Code skill names are namespaced by the plugin name:

```text
/ivista:ivista-install
/ivista:ivista-operate
/ivista:ivista-report
```

## Install The CLI

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.30
ivista doctor
```

Update later:

```bash
ivista update
```

For local development from this repository:

```bash
npm install -g .
ivista doctor
```

## What Works In The CLI

- `ivista doctor`
- `ivista run start`
- `ivista run current`
- `ivista run export`
- `ivista simulator list`
- `ivista simulator boot`
- `ivista device list`
- `ivista device diagnose`
- `ivista wda cache status`
- `ivista wda prepare`
- `ivista wda start`
- `ivista wda stop`
- `ivista wda status`
- `ivista screen shot`
- `ivista screen source`
- `ivista screen texts`
- `ivista wait text`
- `ivista act home`
- `ivista act tap`
- `ivista act double-tap`
- `ivista act two-finger-tap`
- `ivista act long-press`
- `ivista act drag`
- `ivista act pinch`
- `ivista act rotate`
- `ivista act input`
- `ivista act swipe`
- `ivista keyboard dismiss`
- `ivista alert accept`
- `ivista alert dismiss`
- `ivista alert text`
- `ivista alert input`
- `ivista alert buttons`
- `ivista device lock`
- `ivista device unlock`
- `ivista device locked`
- `ivista device info`
- `ivista device battery`
- `ivista device press`
- `ivista app launch`
- `ivista app terminate`

Run exports now include richer Markdown reports with screenshot previews, text snapshot summaries, command counts, failures. Zip exports include the run directory plus `run-report.md`.

## Default User Flow

```bash
ivista doctor
ivista simulator list
ivista simulator boot --name "iPhone 16"
ivista wda start --simulator "iPhone 16" --auto-port
ivista screen shot --output /tmp/ivista.png
ivista act home
ivista wda stop
```

WebDriverAgent is downloaded and cached automatically. Users do not need to clone WDA manually.

Use `--auto-port` when port 8100 is already occupied or a previous WDA runner crashed. Use `ivista wda stop --port <port>` to terminate the runner app and clean the saved session.

## Configuration

The CLI accepts these environment variables:

- `IVISTA_HOME`: defaults to `~/.ivista`
- `IVISTA_WDA_REPO`: defaults to `https://github.com/LLLLLayer/ivista-wda.git`
- `IVISTA_WDA_REF`: defaults to `ivista-wda-v0.1.3`
- `IVISTA_WDA_PORT`: defaults to `8100`
- `IVISTA_WDA_BASE_URL`: overrides the WDA URL for direct connections

Use `--wda-path` only for offline use, enterprise forks, or WDA debugging.

## Skills

- `ivista-install`: install, update, diagnose, repair, and prepare Simulator or real-device prerequisites.
- `ivista-operate`: operate a Simulator or real device after the CLI is available.
- `ivista-report`: export Markdown reports or zip debug bundles from project/conversation/run artifacts.
