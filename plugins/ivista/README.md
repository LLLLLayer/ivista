# iVista Codex Plugin

iVista exposes iOS Simulator and WebDriverAgent controls to Codex through MCP.

## What Works In This Plugin

- `ivista_doctor`
- `ivista_simulator_list`
- `ivista_simulator_boot`
- `ivista_wda_cache_status`
- `ivista_wda_prepare`
- `ivista_wda_start_simulator`
- `ivista_wda_status`
- `ivista_screenshot`
- `ivista_source`
- `ivista_tap`
- `ivista_input`
- `ivista_swipe`
- `ivista_launch_app`
- `ivista_terminate_app`

## Default User Flow

```bash
ivista_doctor
ivista_simulator_list
ivista_simulator_boot
ivista_wda_start_simulator
ivista_screenshot
```

WebDriverAgent is downloaded and cached automatically. Users do not need to clone WDA manually.

## Configuration

The MCP server accepts these environment variables:

- `IVISTA_HOME`: defaults to `~/.ivista`
- `IVISTA_WDA_REPO`: defaults to `https://github.com/appium/WebDriverAgent.git`
- `IVISTA_WDA_REF`: defaults to `v9.15.3`
- `IVISTA_WDA_PORT`: defaults to `8100`
- `IVISTA_WDA_BASE_URL`: overrides the WDA URL for direct connections

Use `wdaPath` only for offline use, enterprise forks, or WDA debugging.
