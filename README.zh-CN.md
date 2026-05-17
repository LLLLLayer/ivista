# iVista

[English](README.md) | 简体中文

iVista 是一个 CLI-first 的 iOS Simulator 和真机测试控制层，基于 WebDriverAgent 提供观察、启动和操作能力。它的目标是让人类开发者和 Coding Agent 使用同一套命令行接口来控制移动端测试表面。

一句话：iVista 把 iOS Simulator 或连接的 iPhone 变成 Agent 可以稳定观察和操作的移动测试表面。

## 当前可用能力

- 检查本机 Xcode、`simctl`、Git 和 iVista 缓存状态。
- 列出和启动 iOS Simulator。
- 列出已连接的物理 iOS 设备。
- 自动下载并缓存固定版本的 iVista WebDriverAgent fork。
- 启动、停止和检查 WebDriverAgent。
- 通过宿主 iOS App 项目复用签名信息启动真机 WDA。
- 获取截图和 accessibility/source 树。
- 执行确定性的 WDA 动作：点击、双击、双指点击、长按、拖拽、缩放、旋转、输入、滑动、Home、收起键盘、处理弹窗、读取设备信息、锁屏/解锁、硬件按键、启动 App、终止 App。
- 提供 skill-only Codex Plugin，让 Agent 学会安装并调用同一个 `ivista` CLI。

当前实现支持 Simulator 工作流，并提供早期真机 WDA 路径。报告、Recipe 和 App Hook 等能力在 [docs/iVista-planning.md](docs/iVista-planning.md) 中规划。

## 环境要求

- macOS，并已安装 Xcode。
- 已选择 Xcode command line tools。
- Node.js 18 或更高版本。
- Git。
- 至少安装一个 iOS Simulator runtime。
- 真机场景需要已信任/已解锁且开启 Developer Mode 的 iPhone 或 iPad，以及 libimobiledevice 提供的 `iproxy`。

如果 Xcode 工具不可用，可以显式选择 Xcode：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## 安装

从仓库安装最新 tag：

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.23
ivista doctor
```

更新已有的全局安装：

```bash
ivista update --ref v0.1.23
```

本地开发安装：

```bash
npm install -g .
ivista version
```

## 快速开始

```bash
ivista doctor
ivista simulator list
ivista simulator boot --name "iPhone 17"
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
ivista screen shot --output /tmp/ivista.png
ivista screen source
```

WDA 启动后，可以操作模拟器：

```bash
ivista act home
ivista act tap --x 120 --y 500
ivista act input "hello from ivista"
ivista act swipe --direction up
ivista app launch --bundle-id com.apple.Preferences
ivista app terminate --bundle-id com.apple.Preferences
```

用完后停止 WDA：

```bash
ivista wda stop
```

大多数命令支持 `--json`，方便 Agent 读取结构化输出：

```bash
ivista simulator list --json
ivista wda status --json
ivista screen shot --json
```

## CLI 命令参考

```bash
ivista version
ivista update [--ref main]
ivista doctor [--json]

ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
ivista simulator boot
ivista simulator boot 1
ivista simulator boot --name "iPhone 17"
ivista simulator boot --udid <simulator-udid>
ivista device list [--connected] [--json]

ivista wda cache status
ivista wda prepare [--ref ivista-wda-v0.1.1]
ivista wda start [--auto-port]
ivista wda start --simulator "iPhone 17" [--port 8100]
ivista wda start --simulator "iPhone 17" --auto-port
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port
ivista wda stop [--port 8100]
ivista wda status [--port 8100]

ivista screen shot [--port 8100] [--output /tmp/ivista.png]
ivista screen source [--port 8100]

ivista act home [--port 8100]
ivista act tap --x 120 --y 500
ivista act double-tap --x 120 --y 500
ivista act two-finger-tap
ivista act long-press --x 120 --y 500 [--duration 1]
ivista act drag --from-x 100 --from-y 600 --to-x 300 --to-y 200 [--duration 0.5]
ivista act pinch --scale 0.5 --velocity -1
ivista act rotate --rotation 1.57 --velocity 1
ivista act input "hello"
ivista act swipe --direction up

ivista keyboard dismiss

ivista alert accept [--name OK]
ivista alert dismiss [--name Cancel]
ivista alert text
ivista alert input "hello"
ivista alert buttons

ivista device lock
ivista device unlock
ivista device locked
ivista device info
ivista device battery
ivista device press --name volumeUp

ivista app launch --bundle-id com.example.app
ivista app terminate --bundle-id com.example.app
```

常用参数：

- `--json`：输出原始 JSON。
- `--simulator <name|udid>`：目标 Simulator 名称或 UDID。
- `--device <name|udid>`：目标物理 iOS 设备名称或 UDID。
- `--name <name>`：Simulator 名称。
- `--udid <udid>`：目标 UDID。
- `--bundle-id <id>`：App bundle id。
- `--base-url <url>`：覆盖 WDA base URL。
- `--port <port>`：WDA 端口，默认 `8100`。
- `--auto-port`：自动选择可用 WDA 端口。
- `--workspace`、`--ios-project`、`--scheme`、`--signing-team` 和 `--wda-bundle-id`：真机 WDA 签名参数。
- `--output <path>`：保存输出文件，目前用于截图。
- `--duration <seconds>`：手势持续时间。
- `--scale <number>` 和 `--velocity <number>`：缩放手势参数。
- `--rotation <radians>`：旋转手势角度。
- `--key-names <names>`：收起键盘时使用的候选按键名，逗号分隔。
- `--wda-path <path>`：使用本地 WDA 工程。
- `--repo <url>` 和 `--ref <ref>`：覆盖 WDA Git 源和 ref。
- `--timeout <ms>` 和 `--wait <ms>`：调整命令超时和 WDA 启动等待时间。

## WebDriverAgent 管理

iVista 默认自动管理 WebDriverAgent。普通用户不需要手动 clone WDA。

默认值：

- WDA repo：`https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref：`ivista-wda-v0.1.1`
- iVista home：`~/.ivista`
- WDA cache：`~/.ivista/cache/webdriveragent/<ref>/`
- WDA port：`8100`

默认 WDA ref 来自 `ivista-wda` fork 的固定 tag。CLI 版本和 WDA 版本独立演进：CLI 固定一个已验证的 WDA ref，WDA fork 可以在自己的 `develop` 分支继续开发，并通过新 tag 发布。

需要时可以覆盖 WDA 源：

```bash
ivista wda prepare --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v0.1.1
ivista wda start --simulator "iPhone 17" --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v0.1.1
```

离线、企业 fork 或调试 WDA 本身时，可以使用本地 WDA 路径：

```bash
ivista wda start --simulator "iPhone 17" --wda-path ./ivista-wda
```

## 配置

iVista 会读取这些环境变量：

- `IVISTA_HOME`：覆盖 iVista 缓存、session 和日志目录。
- `IVISTA_WDA_REPO`：覆盖 WebDriverAgent Git 仓库。
- `IVISTA_WDA_REF`：覆盖 WebDriverAgent Git ref。
- `IVISTA_WDA_PORT`：覆盖默认 WDA 端口。
- `IVISTA_WDA_BASE_URL`：连接已经运行中的 WDA endpoint。

示例：

```bash
IVISTA_WDA_PORT=8200 ivista wda start --simulator "iPhone 17"
IVISTA_WDA_BASE_URL=http://127.0.0.1:8200 ivista screen shot
```

## Codex Plugin

本仓库包含一个 skill-only Codex Plugin，位于 [plugins/ivista](plugins/ivista)。它不暴露 MCP tools，只负责教 Codex 什么时候以及如何安装和调用 `ivista` CLI。

Plugin 目录保持轻量：

- [plugins/ivista/.codex-plugin/plugin.json](plugins/ivista/.codex-plugin/plugin.json)：plugin manifest。
- [plugins/ivista/README.md](plugins/ivista/README.md)：plugin 使用说明。
- [plugins/ivista/skills/ivista-install/SKILL.md](plugins/ivista/skills/ivista-install/SKILL.md)：安装和环境修复说明。
- [plugins/ivista/skills/ivista/SKILL.md](plugins/ivista/skills/ivista/SKILL.md)：设备操作说明。

CLI 实现不放在 plugin bundle 内：

- [bin/ivista.mjs](bin/ivista.mjs)：CLI 入口。
- [src/ivista-runtime.mjs](src/ivista-runtime.mjs)：tool registry 和 runtime dispatcher。
- [src/core.mjs](src/core.mjs)、[src/devices.mjs](src/devices.mjs)、[src/wda.mjs](src/wda.mjs)、[src/actions.mjs](src/actions.mjs)、[src/sessions.mjs](src/sessions.mjs) 和 [src/doctor.mjs](src/doctor.mjs)：按职责拆分的 runtime 模块。

## 开发

安装并运行检查：

```bash
npm install
npm run check
npm run doctor
```

直接从仓库运行 CLI：

```bash
node bin/ivista.mjs version
node bin/ivista.mjs simulator list
```

本地 WDA 开发时，把 WDA fork 放在项目旁边：

```text
ivista/
  ivista-wda/  # 被外层 iVista repo 忽略
```

`ivista-wda/` 是 `git@github.com:LLLLLayer/ivista-wda.git` 的独立 Git checkout。它被本仓库忽略，应当作为独立仓库开发、建分支、打 tag、push。

## 项目结构

```text
.
├── bin/
│   └── ivista.mjs
├── src/
│   ├── actions.mjs
│   ├── core.mjs
│   ├── devices.mjs
│   ├── doctor.mjs
│   ├── ivista-runtime.mjs
│   ├── sessions.mjs
│   └── wda.mjs
├── docs/
│   └── iVista-planning.md
├── plugins/
│   └── ivista/
│       ├── .codex-plugin/
│       │   └── plugin.json
│       ├── README.md
│       └── skills/
│           ├── ivista-install/
│           │   └── SKILL.md
│           └── ivista/
│               └── SKILL.md
├── .agents/
│   └── plugins/
│       └── marketplace.json
├── package.json
├── LICENSE
├── README.md
└── README.zh-CN.md
```

## 当前范围和限制

- 当前主路径是 Simulator。
- 真机还不是完整的一键启动流程。
- iVista 执行确定性 WDA 动作，不内置视觉规划器。
- Recipe、报告生成、App debug hook、Midscene adapter 和设备农场式执行仍在规划中。
- Simulator 验证很快也很有用，但不能完全替代真机测试。

## License

iVista 使用 [MIT License](LICENSE) 开源。

## 开源软件使用说明

iVista 主项目使用 MIT License。CLI 不会把 WebDriverAgent 打包进本仓库的 npm 包或 Codex Plugin bundle。

iVista 默认在运行时下载固定版本的 WDA fork：

- WDA repo：`https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref：`ivista-wda-v0.1.1`
- 缓存目录：`~/.ivista/cache/webdriveragent/<ref>/`

WDA fork 是独立的开源项目，有自己的许可证和第三方声明。如果你分发定制过的 WDA 源码或二进制产物，需要保留 WDA 仓库中的 license 和 vendor notices。

iVista 还会调用用户本机工具，例如 Xcode、`xcodebuild`、`xcrun simctl`、Git、Node.js 和 npm。这些工具不随 iVista 分发，仍受各自许可证约束。
