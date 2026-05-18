# 排查问题

[English](troubleshooting.md)

先跑本机健康检查：

```bash
ivista doctor
```

如果正在使用 iVista Agent Plugin，这整套流程可以交给 `ivista-cleanup` skill。

## WDA 启动

如果 WDA 启动失败：

- 跑 `ivista wda cache status`。
- 跑 `ivista wda prepare` 刷新固定版本的 WDA checkout。
- 如果 `8100` 端口被占用，在正常的 `ivista wda start --simulator ...` 或 `ivista wda start --device ...` 命令上加 `--auto-port`。
- 用 `ivista wda stop --port <port>` 清理旧 runner。
- 首次构建可以加长等待时间：`--wait 180000`。

如果之前的 WDA runner 在模拟器设备上崩过，可以先结束旧进程，再换新端口启动：

```bash
xcrun simctl terminate booted com.facebook.WebDriverAgentRunner.xctrunner || true
ivista wda start --simulator "iPhone 17" --auto-port --wait 180000
```

## 模拟器设备

如果没有可用的模拟器设备：

```bash
ivista simulator list --all
```

到 Xcode Settings > Platforms 安装 iOS 运行时，然后重新执行：

```bash
ivista simulator list
ivista simulator boot
```

`booted` 表示模拟器设备已经运行，可以被 WDA 使用。

## 真实设备

排查签名或无线传输前，先跑：

```bash
ivista device list --connected
ivista device diagnose --device <device-udid>
```

如果 Xcode 不能构建到真实设备：

- 解锁设备。
- 在设备上信任这台 Mac。
- 开启 Developer Mode。
- 确认当前 Xcode 支持设备上的 iOS 版本。
- 尽量在宿主 iOS 项目目录里运行 `ivista wda start`，让 iVista 推断签名配置。

无线失败时，先确认 `devicectl` 能在局域网看到设备。可以用 `--usb` 强制走 USB 转发。

## Agent 操作

Agent 操作设备时：

- 用 `ivista observe --json` 做 checkpoint，不要拆成多条 screenshot/source/text 命令。
- 动作后用 `ivista wait text`、`ivista wait gone`、`ivista wait idle` 或 `ivista wait app`。
- 文本定位失败时，看返回的候选建议，再用 `--contains`、`--regex`、`--index` 或坐标重试。

## 日志和素材

iVista 会把 run 素材放在 `~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/`。

需要分享完整现场时导出报告：

```bash
ivista run export --format markdown
ivista run export --format zip
```
