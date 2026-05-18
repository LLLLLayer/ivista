# iVista

[English](README.md) | 简体中文

iVista 是一个 CLI 优先的 iOS 控制层，面向人类开发者和 Coding Agent。它基于 WebDriverAgent，把 iOS 模拟器设备或连接的 iPhone/iPad 变成可观察、可脚本化的测试表面。

当你希望 Agent 看见当前手机屏幕、等待 UI 状态、按 accessibility 文本点击、输入、滑动、启动 App、收集现场素材并导出报告时，可以使用 iVista，而不是手动打开 Xcode 跑 WDA。

## 亮点

- 模拟器设备和真实设备使用同一套 CLI。
- 自动下载、缓存、启动、停止和检查 WebDriverAgent。
- `ivista observe` 一次性获取截图、source、可见文本、当前 App 和 WDA 状态。
- 确定性操作：文本/坐标点击、滚动查找后点击、双击、双指点击、长按、拖拽、缩放、旋转、输入、滑动、Home、弹窗、设备信息、锁屏/解锁、硬件按键、启动 App、终止 App。
- Agent 友好的等待：文本出现、文本消失、屏幕稳定、指定 App 激活。
- 按项目/对话/run 归档素材到 `~/.ivista`，并支持 Markdown 和 zip 导出。
- 提供 skill-only Codex / Claude Code plugin，让 Agent 学会安装和操作同一个 `ivista` CLI。

## 环境要求

- macOS，并已安装 Xcode。
- 已选择 Xcode command line tools。
- Node.js 18 或更高版本。
- Git。
- 至少安装一个 iOS 模拟器运行时。
- 真实设备场景需要已解锁/已信任且开启 Developer Mode 的 iPhone 或 iPad。USB 转发使用 `iproxy`；无线转发使用 Xcode/devicectl 暴露的 CoreDevice 无线隧道。

如果 Xcode 工具不可用，可以显式选择 Xcode：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## 安装

安装当前版本：

```bash
npm install -g git+https://github.com/LLLLLayer/ivista.git#v1.0.1
ivista doctor
```

更新已有安装：

```bash
ivista update --ref v1.0.1
```

## 快速开始

### 模拟器设备

```bash
ivista doctor
ivista run start --project . --conversation smoke-settings
ivista simulator list
ivista simulator boot --name "iPhone 17"
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
ivista observe --port <printed-port>
```

操作模拟器设备：

```bash
ivista act home --port <printed-port>
ivista act tap --port <printed-port> --text "设置"
ivista act tap --port <printed-port> --text "通用" --scroll
ivista wait app --port <printed-port> --bundle-id com.apple.Preferences
ivista wait idle --port <printed-port>
ivista observe --port <printed-port> --json
```

用完后停止 WDA：

```bash
ivista wda stop --port <printed-port>
```

### 真实设备

尽量在宿主 iOS App 项目目录下运行，这样 iVista 可以推断签名配置：

```bash
ivista doctor
ivista run start --project . --conversation real-device-smoke
ivista device list --connected
ivista device diagnose --device <device-udid>
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port --wait 180000
ivista observe --port <port>
```

如果签名无法自动推断，显式传入签名参数：

```bash
ivista wda start \
  --device <device-udid> \
  --signing-team <TEAMID> \
  --wda-bundle-id <host.bundle.id>.ivista.wda \
  --auto-port \
  --wait 180000
```

## 观察策略

当 Agent 需要完整 checkpoint 时使用 `observe`：截图、source XML、可见文本、当前 App、WDA 状态和 artifact 路径会一次性返回。

```bash
ivista observe --port <port> --json
```

适合 observe 的时机：

- WDA 启动后或 App 启动后；
- 当前页面不确定、准备导航前；
- 页面跳转、弹窗处理或关键状态变化后；
- 语义操作失败、准备重试前；
- 导出报告前。

连续小动作中间优先用更轻量的等待，不必每一步都 observe：

```bash
ivista wait idle --port <port> --timeout 15000
ivista wait text "关于本机" --port <port> --timeout 10000
ivista wait gone "Loading" --port <port> --timeout 10000
ivista wait app --bundle-id com.apple.Preferences --port <port>
```

语义操作找不到文本时，iVista 会返回结构化 hints 和候选信息，方便 Agent 用 `--contains`、`--regex`、`--index` 或坐标 fallback 重试。

## 报告和素材

素材按项目、对话和 run 归档：

```text
~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/
  run.json
  events.ndjson
  artifacts/
    0001-observe-screenshot.png
    0002-observe-source.xml
    0003-observe-texts.json
~/.ivista/projects/<project-key>/conversations/<conversation-id>/exports/
  ivista-run-<run-id>.md
  ivista-run-<run-id>.zip
```

导出报告：

```bash
ivista run export --format markdown
ivista run export --format zip
```

Markdown 报告包含元信息、命令数量、失败命令、素材链接、截图预览和文本快照。zip 会包含整个 run 目录和 `run-report.md`。

## 真实设备配置

iVista 可以通过 USB 或 CoreDevice 无线隧道在真实设备上启动 WDA。建议在宿主 iOS App 项目目录下运行，这样 iVista 可以推断签名配置。

```bash
ivista device list --connected
ivista device diagnose --device <device-udid>
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port --wait 180000
ivista observe --port <port>
```

如果签名无法自动推断：

```bash
ivista wda start \
  --device <device-udid> \
  --signing-team <TEAMID> \
  --wda-bundle-id <host.bundle.id>.ivista.wda \
  --auto-port \
  --wait 180000
```

无线真实设备可用的前提是 `devicectl` 能在局域网看到设备并提供 CoreDevice tunnel 地址。可以用 `--usb` 强制走 USB 转发。

## Agent Plugin

Plugin 是 skill-only：只安装 Agent 使用说明，不包含 CLI runtime。请先单独安装 CLI。

Codex：

```bash
codex plugin marketplace add LLLLLayer/ivista
```

然后打开 Codex，在 plugin marketplace 里安装 `iVista`。固定到某个版本：

```bash
codex plugin marketplace add LLLLLayer/ivista --ref v1.0.1
```

Claude Code：

```text
/plugin marketplace add LLLLLayer/ivista
/plugin install ivista@ivista
```

本地测试 Claude Code：

```bash
claude --plugin-dir ./plugins/ivista
```

Claude Code skill 名称：

```text
/ivista:ivista-install
/ivista:ivista-operate
/ivista:ivista-cleanup
/ivista:ivista-report
```

## CLI 命令参考

README 只保留快速上手路径。完整命令、示例和常用参数见 [docs/cli.zh-CN.md](docs/cli.zh-CN.md)，英文版见 [docs/cli.md](docs/cli.md)。

## WebDriverAgent

iVista 默认自动管理 WebDriverAgent。普通用户不需要手动 clone WDA。

默认值：

- WDA repo：`https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref：`ivista-wda-v1.0.0`
- iVista home：`~/.ivista`
- WDA cache：`~/.ivista/cache/webdriveragent/<ref>/`
- WDA port：`8100`

CLI 会固定一个已验证的 WDA ref。WDA fork 独立演进，并在运行时下载到本地缓存。

只有需要调试或使用企业 fork 时才覆盖 WDA：

```bash
ivista wda prepare --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v1.0.0
ivista wda start --simulator "iPhone 17" --repo https://github.com/LLLLLayer/ivista-wda.git --ref ivista-wda-v1.0.0
ivista wda start --simulator "iPhone 17" --wda-path ./ivista-wda
```

## 配置

- `IVISTA_HOME`：覆盖 iVista 缓存、session 和日志目录。
- `IVISTA_WDA_REPO`：覆盖 WebDriverAgent Git 仓库。
- `IVISTA_WDA_REF`：覆盖 WebDriverAgent Git ref。
- `IVISTA_WDA_PORT`：覆盖默认 WDA 端口。
- `IVISTA_WDA_BASE_URL`：连接已运行的 WDA endpoint。

示例：

```bash
IVISTA_WDA_PORT=8200 ivista wda start --simulator "iPhone 17"
IVISTA_WDA_BASE_URL=http://127.0.0.1:8200 ivista observe
```

## 更多文档

- [CLI 命令参考](docs/cli.zh-CN.md)
- [排查问题](docs/troubleshooting.zh-CN.md)
- [开发](docs/development.zh-CN.md)

## License 和开源软件使用说明

iVista 使用 [MIT License](LICENSE) 开源。

CLI 不会把 WebDriverAgent 打包进本仓库的 npm 包、Codex plugin bundle 或 Claude Code plugin bundle。iVista 默认在运行时下载固定版本的 WDA fork：

- WDA repo：`https://github.com/LLLLLayer/ivista-wda.git`
- WDA ref：`ivista-wda-v1.0.0`
- 缓存目录：`~/.ivista/cache/webdriveragent/<ref>/`

WDA fork 是独立开源项目，有自己的许可证和第三方声明。iVista 还会调用本机工具，例如 Xcode、`xcodebuild`、`xcrun simctl`、Git、Node.js 和 npm；这些工具不随 iVista 分发，仍受各自许可证约束。
