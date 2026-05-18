# iVista CLI 命令参考

[English](cli.md)

这份文档是 iVista 的公开命令参考。README 只保留快速上手路径，完整命令、示例和常用参数放在这里。

## 全局命令

```bash
ivista version
ivista update [--ref main]
ivista doctor [--json]
ivista --help
```

- `version`：查看当前安装的 CLI 版本。
- `update`：更新 Git 安装的 CLI 到指定 ref。
- `doctor`：检查本机依赖、Xcode 工具、模拟器设备、WDA 缓存和常见修复建议。
- `--json`：让支持的命令输出机器可读 JSON。

## Run 和报告

Agent 操作 App 时，建议使用 run 元信息，把截图、source、操作记录和导出报告按项目、对话、run 串起来。

```bash
ivista run start [--project .] [--conversation <id>] [--run <id>] [--title <title>]
ivista run current [--json]
ivista run export [--format markdown|zip] [--output report.md]
```

默认素材目录：

```text
~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/
  run.json
  events.ndjson
  artifacts/
~/.ivista/projects/<project-key>/conversations/<conversation-id>/exports/
```

## 模拟器设备

```bash
ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
ivista simulator boot
ivista simulator boot 1
ivista simulator boot --name "iPhone 17"
ivista simulator boot --udid <simulator-udid>
```

- `simulator list`：默认展示去重后的精简列表。
- `--all`：展示所有 runtime 和重复设备。
- `--booted`：只展示正在运行的模拟器设备。
- `simulator boot`：打开交互式选择器，用上下键选择，回车启动。
- `simulator boot 1`：按展示序号启动。

## 真实设备

```bash
ivista device list [--connected] [--json]
ivista device diagnose [--device <device-udid>] [--port 8100]
ivista device info
ivista device battery
ivista device lock
ivista device unlock
ivista device locked
ivista device press --name volumeUp
```

真实设备 WDA 启动失败、无线连接不确定、端口不通时，先跑 `device diagnose`。它会检查设备发现、tunnel 线索、WDA 可达性，以及可能的签名或传输问题。

## WebDriverAgent

```bash
ivista wda cache status
ivista wda prepare [--ref ivista-wda-v0.1.3]
ivista wda start --simulator "iPhone 17" [--port 8100]
ivista wda start --device <device-udid> --workspace MyApp.xcworkspace --scheme MyApp --auto-port
ivista wda stop [--port 8100]
ivista wda status [--port 8100]
```

模拟器设备示例：

```bash
ivista simulator boot --name "iPhone 17"
ivista wda prepare
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
ivista wda status --port <port>
```

真实设备示例：

```bash
ivista device list --connected
ivista wda start \
  --device <device-udid> \
  --workspace MyApp.xcworkspace \
  --scheme MyApp \
  --auto-port \
  --wait 180000
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

## 观察和屏幕

```bash
ivista observe [--port 8100]
ivista screen shot [--port 8100] [--output ~/.ivista/screenshot.png]
ivista screen source [--port 8100]
ivista screen texts [--port 8100]
```

- `observe`：保存一个 checkpoint，包含截图、source、文本摘要、当前 App 和素材路径。
- `screen shot`：截取 PNG。不传 `--output` 时输出 base64 元信息。
- `screen source`：输出 WDA page source XML。
- `screen texts`：从 source XML 提取可见 Accessibility 文本。

`observe` 适合决策点、风险操作前、页面跳转后、导出报告前使用。连续动作里更推荐用精准等待命令。

## 等待

```bash
ivista wait text "Wi-Fi" [--port 8100] [--timeout 10000]
ivista wait gone "Loading" [--port 8100] [--timeout 10000]
ivista wait idle [--port 8100] [--stable-ms 1000] [--poll-ms 500]
ivista wait app --bundle-id com.apple.Preferences [--port 8100]
```

- `wait text`：等待匹配的 Accessibility 文本出现。
- `wait gone`：等待匹配文本消失。
- `wait idle`：等待 source 连续稳定一段时间。
- `wait app`：等待前台 App 匹配指定 bundle id。

文本匹配支持精确、包含和正则：

```bash
ivista wait text --contains "语言"
ivista wait text --regex "Wi-?Fi"
```

## 操作

```bash
ivista act home [--port 8100]
ivista act tap --x 120 --y 500
ivista act tap --text "Wi-Fi"
ivista act tap --contains "语言"
ivista act double-tap --x 120 --y 500
ivista act double-tap --text "照片"
ivista act two-finger-tap
ivista act long-press --x 120 --y 500 [--duration 1]
ivista act long-press --text "App" [--duration 1]
ivista act drag --from-x 100 --from-y 600 --to-x 300 --to-y 200 [--duration 0.5]
ivista act pinch --scale 0.5 --velocity -1
ivista act rotate --rotation 1.57 --velocity 1
ivista act input "hello"
ivista act swipe --direction up
```

文本类操作基于 WDA Accessibility source 定位。如果文本没找到，iVista 会输出相近候选，方便 Agent 调整下一步。

## 键盘和弹窗

```bash
ivista keyboard dismiss

ivista alert accept [--name OK]
ivista alert dismiss [--name Cancel]
ivista alert text
ivista alert input "hello"
ivista alert buttons
```

系统权限弹窗和 WDA 能识别的 modal alert，可以优先用 alert 命令处理。

## App

```bash
ivista app launch --bundle-id com.example.app
ivista app terminate --bundle-id com.example.app
```

## 常用参数

- `--json`：输出原始 JSON。
- `--simulator <name|udid>`：目标模拟器设备名称或 UDID。
- `--device <name|udid>`：目标真实设备名称或 UDID。
- `--bundle-id <id>`：App bundle id。
- `--base-url <url>`：覆盖 WDA base URL。
- `--port <port>`：WDA 端口，默认 `8100`。
- `--auto-port`：自动选择可用 WDA 端口。
- `--project <path>`、`--conversation <id>`、`--run <id>`、`--title <title>`：设置 run 元信息。
- `--workspace`、`--ios-project`、`--scheme`、`--signing-team`、`--wda-bundle-id`：真实设备签名参数。
- `--network`、`--usb`：强制真实设备传输模式。
- `--text <text>`、`--contains <text>`、`--regex <pattern>`、`--index <n>`：按 Accessibility 的 `name`、`label` 或 `value` 匹配。
- `--stable-ms <ms>`、`--poll-ms <ms>`：调整等待和 idle 轮询。
- `--wda-path <path>`、`--repo <url>`、`--ref <ref>`：覆盖 WDA 来源。
- `--timeout <ms>`、`--wait <ms>`：调整命令超时和 WDA 启动等待时间。

## 给 Agent 的建议

- 需要可靠 checkpoint 或报告证据时，用 `observe`。
- 动作后优先用 `wait text`、`wait gone`、`wait idle` 或 `wait app`，不要靠固定 sleep。
- 结果要继续交给工具或模型处理时，用 `--json`。
- 一个目标设备保持一个 WDA 端口；多设备并行时用 `--auto-port`。
