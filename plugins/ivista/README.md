# iVista Codex Plugin

iVista is a CLI-first Codex plugin for iOS Simulator and WebDriverAgent control. The plugin contributes a skill that tells Codex how to install and use the `ivista` CLI.

## Install The CLI

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.4
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
- `ivista simulator list`
- `ivista simulator boot`
- `ivista wda cache status`
- `ivista wda prepare`
- `ivista wda start`
- `ivista wda status`
- `ivista screen shot`
- `ivista screen source`
- `ivista act tap`
- `ivista act input`
- `ivista act swipe`
- `ivista app launch`
- `ivista app terminate`

## Default User Flow

```bash
ivista doctor
ivista simulator list
ivista simulator boot --name "iPhone 16"
ivista wda start --simulator "iPhone 16"
ivista screen shot
```

WebDriverAgent is downloaded and cached automatically. Users do not need to clone WDA manually.

## Configuration

The CLI accepts these environment variables:

- `IVISTA_HOME`: defaults to `~/.ivista`
- `IVISTA_WDA_REPO`: defaults to `https://github.com/appium/WebDriverAgent.git`
- `IVISTA_WDA_REF`: defaults to `v9.15.3`
- `IVISTA_WDA_PORT`: defaults to `8100`
- `IVISTA_WDA_BASE_URL`: overrides the WDA URL for direct connections

Use `--wda-path` only for offline use, enterprise forks, or WDA debugging.
