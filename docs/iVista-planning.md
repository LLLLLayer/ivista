# iVista 项目规划与上下文恢复

最后更新：2026-05-17

这份文档的目的有两个：

1. 记录 iVista 当前已经做成什么、还没做什么。
2. 让后续重开对话时，Agent 可以快速恢复项目上下文，不需要重新从零理解。

## 1. 一句话定位

iVista 是一个面向 Apple 设备的 Agent-native 本地测试与设备操作层。

它把 iOS Simulator、iPhone、iPad 变成可以被 CLI 和 Agent 稳定操作的测试表面，核心能力包括：

- 发现和启动 Simulator。
- 自动下载、缓存、启动 WebDriverAgent。
- 截图、读取 source、点击、输入、滑动、手势、Home、系统按钮、App 启停。
- 给 Codex 这类宿主 Agent 一个低摩擦、可复用、可诊断的手机操作入口。

一句英文定位：

> iVista turns an iOS Simulator, iPhone, or iPad into an Agent-operable test surface.

中文理解：

> 让研发用一句话、一个脚本或一个 Agent，对本地 Simulator 或 iPhone/iPad 做可观察、可回放、可诊断的真实操作。

## 2. 当前状态

### 2.1 外层 iVista 仓库

仓库路径：

```text
/Users/bytedance/Downloads/GitHub/ivista
```

当前主仓库负责：

- CLI。
- CLI runtime。
- Codex / Claude Code Plugin thin wrapper。
- 文档。
- WDA 下载、缓存、启动逻辑。

当前 CLI 版本：

```text
0.1.30
```

关键文件：

```text
bin/ivista.mjs
src/cli/
src/ivista-runtime.mjs
src/core.mjs
src/devices.mjs
src/wda.mjs
src/actions.mjs
src/sessions.mjs
src/doctor.mjs
plugins/ivista/.codex-plugin/plugin.json
plugins/ivista/.claude-plugin/plugin.json
plugins/ivista/skills/ivista-install/SKILL.md
plugins/ivista/skills/ivista-operate/SKILL.md
plugins/ivista/skills/ivista-report/SKILL.md
.claude-plugin/marketplace.json
docs/iVista-planning.md
README.md
README.zh-CN.md
```

当前默认 WDA 源：

```text
https://github.com/LLLLLayer/ivista-wda.git
```

当前默认 WDA ref：

```text
ivista-wda-v0.1.3
```

这意味着默认用户路径会下载固定 tag 的 WDA，而不是下载主仓库里的源代码。

### 2.2 WDA fork 仓库

WDA fork 放在外层仓库目录下，但被外层 `.gitignore` 忽略：

```text
/Users/bytedance/Downloads/GitHub/ivista/ivista-wda
```

它是一个独立 Git 仓库：

```text
remote: git@github.com:LLLLLayer/ivista-wda.git
branch: develop
```

当前策略：

- WDA fork 不放进 npm 包。
- WDA fork 不放进 Codex / Claude Code Plugin bundle。
- CLI 首次使用时从指定 git ref 下载到本地缓存。
- 外层 repo 只记录默认 WDA repo/ref。
- 需要定制 WDA 时，在 `ivista-wda` 独立仓库开发、打 tag，然后更新外层 CLI 默认 ref。

已有 tag：

```text
ivista-wda-v0.1.3
```

这个 tag 当前是默认用户路径使用的 iVista WDA 版本，包含单页状态页和原生 WDA 能力。后续 UI、图标、真机提示等定制完成后，应打新的 tag，例如：

```text
ivista-wda-v0.2.0
```

然后再把 `src/core.mjs` 里的默认 WDA ref 升级到新 tag。

### 2.3 当前 WDA 本地改动

当前 `ivista-wda/develop` 上已有本地 WDA 定制改动，尚未作为正式 tag 进入外层 CLI 默认 ref。

改动方向：

- WebDriverAgentRunner 启动时展示原生 UIKit 状态页。
- 黑色背景，显示 iVista / WebDriverAgent / Connected / endpoint。
- WDA HTTP server 启动成功后通知 UI 更新为 Connected。
- WDA HTTP server 启动失败时不再直接 `abort()`，而是显示失败状态，避免用户看到“意外退出”却不知道原因。
- 增加 `GET /` HTML 状态页，方便浏览器打开 WDA 端口看到服务状态。
- 尝试把 Runner target 的产品名改为 `iVista`。由于 XCTest runner 的产物会被 Xcode 包装成 `*-Runner.app`，当前更准确的 App 名称预期是 `iVista-Runner`，不是纯 `iVista`。

已验证：

- 使用本地 WDA 路径启动 WDA 可成功。
- `/status` 可访问。
- Simulator 上能看到黑色原生状态 UI。
- CLI 的 screenshot/source/home/tap/input 等链路已跑通。

后续需要决定：

- 接受 `iVista-Runner` 这个名称。
- 或者做真正的 host app / post-install patch，让用户看到纯 `iVista`。
- 或者先不追求图标和名称完美，把重点放在稳定控制链路。

## 3. 已完成 CLI 能力

当前 CLI 已经不是纯规划，已有可用闭环。

### 3.1 基础命令

```bash
ivista version
ivista update [--ref main]
ivista doctor [--json]
```

`doctor` 用于检查 Node、npm、git、Xcode、xcrun、Simulator、WDA 缓存等环境，并输出修复建议。

### 3.2 Simulator

```bash
ivista simulator list [--all] [--booted] [--iphone|--ipad] [--json]
ivista simulator boot
ivista simulator boot 1
ivista simulator boot --name "iPhone 16"
```

当前设计：

- `list` 默认输出紧凑、去重、适合人看的列表。
- `--all` 显示所有 runtime 下的重复设备。
- `boot` 支持交互式上下选择，按 Enter 直接启动。
- `booted` 表示 Simulator 已经启动，也就是用户能看到的模拟器窗口处于运行状态。

### 3.3 WDA 管理

```bash
ivista wda cache status
ivista wda prepare [--ref ivista-wda-v0.1.3]
ivista wda start [--auto-port]
ivista wda start --simulator "iPhone 16" [--port 8100] [--wait 120000]
ivista wda stop [--port 8100]
ivista wda status [--port 8100]
```

当前设计：

- 用户不需要手动下载 WDA 工程。
- 默认从 `https://github.com/LLLLLayer/ivista-wda.git` 下载指定 ref。
- 只有一个 booted Simulator 时，`wda start` 可以自动推断目标；多个 booted 时要求显式传入 `--simulator`/`--name`/`--udid`。
- 下载到 `~/.ivista/cache/webdriveragent/<ref>/`。
- `--wda-path` 是高级逃生口，服务于本地调试 WDA、企业 fork、离线环境。
- `wda prepare` 已有下载进度展示，但 git 自身进度在某些终端里可能比较刷屏，后续可继续打磨。
- `wda start` 会启动 `xcodebuild test` 并轮询 `/status`。
- 如果端口冲突，推荐换端口或先 `wda stop`。

### 3.4 屏幕读取

```bash
ivista run start [--project .] [--conversation <id>] [--run <id>]
ivista run current
ivista run export [--format markdown|zip]
ivista screen shot [--port 8100] [--output /tmp/ivista.png] [--json]
ivista screen source [--port 8100] [--json]
ivista screen texts [--port 8100] [--json]
ivista wait text "Wi-Fi" [--port 8100] [--timeout 10000]
```

用途：

- 给 Agent 看当前屏幕。
- 给调试报告保存现场。
- 结合 source/accessibility texts 做更稳定的元素定位和等待。
- 默认将截图、source、texts 和命令事件按项目/AI 对话/run 归档到 `~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/`，后续用于导出对话报告。
- `run export --format markdown` 输出带截图预览、文本快照摘要、失败命令、命令计数 的可读报告。
- `run export --format zip` 会包含 run 目录和一份 `run-report.md`，方便交给用户或挂到后续对话里继续分析。

### 3.5 操作能力

当前已对齐一批 WDA 交互：

```bash
ivista act home
ivista act tap --x 120 --y 500
ivista act tap --text "Wi-Fi"
ivista act tap --contains "语言" [--index 1]
ivista act double-tap --x 120 --y 500
ivista act double-tap --text "照片"
ivista act two-finger-tap
ivista act long-press --x 120 --y 500 [--duration 1.5]
ivista act long-press --text "App" [--duration 1.5]
ivista act drag --from-x 100 --from-y 600 --to-x 100 --to-y 200 [--duration 1]
ivista act pinch --scale 2 --velocity 1
ivista act rotate --rotation 1.57 --velocity 1
ivista act input "hello"
ivista act swipe --direction up
```

还有：

```bash
ivista keyboard dismiss
ivista alert accept
ivista alert dismiss
ivista alert text
ivista alert input "hello"
ivista alert buttons
ivista device lock
ivista device unlock
ivista device locked
ivista device info
ivista device battery
ivista device press --button home
ivista app launch --bundle-id com.example.app
ivista app terminate --bundle-id com.example.app
```

## 4. 产品判断

### 4.1 WDA 是手，不是脑

WDA 负责底层设备控制：

- 启动 App。
- 截图。
- 获取元素树。
- 点击、输入、滑动、手势。
- Home、系统按钮、弹窗。

WDA 不负责理解“打开消息页面创建一个群聊”这种业务目标，也不负责报告、失败归因、上下文压缩、调试体验。

iVista 要补的是 WDA 之上的产品层和 Agent 层。

### 4.2 Midscene 可选，不是底座

Midscene 的价值在视觉语义动作、断言、YAML、报告和跨端抽象。

但在 Codex、Claude Code、Trae、Cursor 这类宿主 Agent 场景里，Agent 自己已经具备语言理解和多模态推理能力。

所以当前判断是：

- iVista 核心不强依赖 Midscene。
- 核心能力走自有 CLI + WDA 封装。
- Midscene 可以作为后续 adapter，用于视觉断言、AI 查询、报告增强。
- 宿主 Agent 有模型时，优先复用宿主 Agent 的能力。
- 没有宿主多模态能力时，再接外部视觉模型。

### 4.3 CLI-first，不以 MCP 为首期主路径

当前产品形态选择：

- CLI 是核心入口。
- Codex / Claude Code Plugin 只做 thin skill，指导 Agent 安装和调用 CLI。
- MCP 可以后续补，但不是 MVP 必需。

原因：

- CLI 可以被人、Agent、CI、脚本同时使用。
- 调试路径简单，用户可以直接复制命令验证。
- Plugin 不需要负责长生命周期 server。
- 也避免用户为了使用 Plugin 又额外理解 MCP。

### 4.4 Plugin 不携带 CLI runtime

当前合理边界：

```text
bin/                  npm binary entry
src/cli/              CLI shell: argv parsing, command registry, help, formatting, picker, update
src/*.mjs             modular runtime: core/devices/wda/actions/sessions/doctor
plugins/ivista/       Codex / Claude Code Plugin metadata + install/use/report Skills only
ivista-wda/           independent ignored WDA fork repo
docs/                 project docs
```

用户安装 CLI 时下载 npm 包里的 CLI 代码。

用户安装 Plugin 时只下载 Plugin 元数据和 Skill，不把运行时代码塞进 Plugin bundle。

当前 Plugin 目录同时支持两个宿主：

- Codex 读取 `plugins/ivista/.codex-plugin/plugin.json`。
- Claude Code 读取 `plugins/ivista/.claude-plugin/plugin.json`。
- Claude Code marketplace 读取仓库根目录 `.claude-plugin/marketplace.json`，其中 `source` 指向 `./plugins/ivista`。
- 两边共享根目录下的 `skills/`，不维护两套 skill 内容。

这更接近市面上合理做法：thin plugin + external CLI/package。

### 4.5 Simulator-first，真机后置

首期先把 Simulator 做稳：

- 不需要真机信任。
- 不需要 Developer Mode。
- 不需要 Team 签名。
- 不需要 `iproxy`。
- 更适合快速验证 CLI、WDA client、截图、source、动作执行。

真机仍然是关键差异点，但一键真机 bootstrap 应在 Simulator 闭环稳定后推进。

## 5. 目标用户

### 5.1 一线客户端研发

他们需要：

- 不想理解 WDA、签名、iproxy、xcodebuild 细节。
- 不想手动打开 Xcode 跑 WebDriverAgent。
- 开发完后用自然语言或命令跑一次真实设备验收。
- 出问题时拿到截图、日志、当前页面结构和复现步骤。

### 5.2 Agent 用户

他们可能使用：

- Codex。
- Claude Code。
- Trae。
- Cursor。
- 其他带 shell 能力的本地 Agent。

他们需要的是稳定、结构化、低摩擦的手机操作工具，而不是只能在某一个 Agent 内工作的脚本。

### 5.3 测试和质量团队

他们需要：

- 把研发口语化验收流程转成可复用 recipe。
- 在本地、CI 或设备池里运行 smoke test。
- 获取结构化报告。

## 6. 不做什么

首期明确不做：

- 不做 iOS 无宿主自操作。普通 iOS App 不能全局控制其他 App。
- 不承诺脱离 Mac 启动 WDA。真机 WDA 的标准链路仍然需要 Mac/Xcode 或云端 Mac。
- 不把“AI 自动探索所有业务路径”作为首期核心卖点。
- 不把慢速截图大模型链路用于高频回归测试。
- 不强绑 Midscene、Appium、go-ios、tidevice 中任意一个实现。
- 不把 Simulator 能力包装成真机等价能力。Simulator 是低摩擦验证和研发调试路径，真机用于真实设备行为验证。

## 7. 目标架构

```text
Host Agent / Human
        |
        v
iVista Skill / CLI
        |
        v
iVista Runtime
        |
        v
Backends: WDA / Simulator / xcodebuild / App Hooks / Midscene
        |
        v
iOS Simulator / iPhone / iPad
```

### 7.1 CLI

CLI 是当前主产品面。

原则：

- 人能直接跑。
- Agent 能稳定调用。
- 所有关键结果都支持 `--json`。
- 错误信息要给 fix hint。
- 能自动管理 WDA，不要求用户手动下载 Xcode 工程。

### 7.2 Runtime

Runtime 负责：

- Simulator 发现、过滤、启动、状态判断。
- WDA repo/ref 解析。
- WDA 下载、缓存、校验。
- `xcodebuild test` 启动。
- WDA `/status` 轮询。
- WDA HTTP API 封装。
- 进程、日志、端口状态管理。

### 7.3 Plugin Skill

Codex / Claude Code Plugin 当前只负责：

- 告诉 Agent 如何安装 `ivista` CLI。
- 告诉 Agent 如何跑 `doctor`、启动 Simulator、启动 WDA。
- 告诉 Agent 如何截图、看 source、执行动作。
- 给 Agent 一套稳定操作手册。

Plugin 不应该变成第二套 runtime。

### 7.4 WDA fork

WDA fork 的职责：

- 提供 iVista pinned WDA 基线。
- 承载 iVista 需要的 WDA 定制，例如原生状态页、错误展示、图标、HTTP status page。
- 保持独立 tag 发布节奏。

外层 CLI 只依赖某个 tag，不依赖 WDA 工作区本身。

## 8. WDA 定制策略

### 8.1 为什么要 fork WDA

fork WDA 是合理的，因为 iVista 需要控制首次体验：

- 用户看到一个叫 WebDriverAgentRunner-Runner 的黑屏/崩溃弹窗，会不明所以。
- 用户需要知道 WDA 是否已经连上 Mac。
- 端口冲突、启动失败时需要展示清晰状态，而不是直接 crash。
- 后续可能需要补 icon、branding、健康状态、debug 信息。

但 fork 的边界要克制：

- 不把 WDA 源码塞进 npm 包。
- 不把 WDA 源码塞进 Plugin。
- 不在外层 repo 的 git history 里混进 WDA 历史。
- 通过独立仓库和 tag 管理 WDA 版本。

### 8.2 当前 WDA UI 方案

当前选择先在 XCTest runner 里写原生 UIKit 状态页。

原因：

- WebDriverAgentRunner-Runner.app 本质上仍是一个 XCTest runner app，可以显示 UI。
- 不需要先做完整 host app。
- 能快速解决“用户打开看到黑屏/崩溃，不知道发生什么”的问题。

当前 UI 应显示：

- `iVista`
- `WebDriverAgent`
- `Starting` / `Connected` / `Connection failed`
- 当前 endpoint，例如 `http://127.0.0.1:8305` 或局域网地址。
- 简短状态说明。

### 8.3 后续 UI 取舍

有三条路径：

1. 继续使用 XCTest runner UI。
2. 增加真正的 host app target，让 App 名称和图标完全可控。
3. 保持 WDA 原生，只通过 CLI/日志改善体验。

当前建议：

- 短期先用 XCTest runner UI，把状态页、错误页、HTTP `/` 做稳。
- 中期如果用户确实在意 App 名称和图标，再做 host app target。
- 不要为了图标过早大改 WDA 工程结构。

## 9. 一线研发流程

### 9.1 首次使用

```bash
ivista version
ivista doctor
ivista simulator list
ivista simulator boot
ivista wda prepare
ivista wda start --simulator "iPhone 17" --port 8200 --wait 180000
ivista wda status --port 8200
```

### 9.2 验证设备可操作

```bash
ivista screen shot --port 8200 --output /tmp/ivista.png
ivista screen source --port 8200
ivista act home --port 8200
ivista act tap --port 8200 --x 200 --y 500
ivista act input "hello from ivista" --port 8200
```

### 9.3 Agent 使用方式

用户可以在 Codex 里说：

```text
用 iVista 打开我的 App，进入消息页，创建一个面对面群聊，然后生成报告。
```

Agent 应执行：

```bash
ivista doctor
ivista wda status --json
ivista app launch --bundle-id com.example.app
ivista screen shot --json
ivista screen source --json
ivista screen texts --json
ivista wait text "Done"
ivista act tap/input/swipe
```

每一步都应该拿截图或 source 做 checkpoint。

## 10. 高频测试建议

高频测试不应该依赖 AI 每一步截图思考。

建议分层：

- 单元测试覆盖纯逻辑。
- 状态测试覆盖 ViewModel / Store / Reducer。
- Mock server 覆盖接口组合。
- App 内 debug hooks 覆盖深链路跳转和状态注入。
- iVista 覆盖真实设备 smoke、复杂链路验收、异常复现和报告。

iVista 最适合：

- 本地研发验收。
- 一句话 smoke test。
- 问题复现。
- 真实设备链路调试。
- 带截图和 source 的报告。

## 11. App 内 Debug Hooks

如果只控制自家 App，后续建议建设 App 内调试通道，降低对纯 WDA 点击的依赖。

可提供：

- `openPage`
- `setMockState`
- `performAction`
- `getCurrentRoute`
- `getVisibleTexts`
- `getLastToast`
- `captureAppSnapshot`
- `dumpStore`
- `clearCache`
- `loginAs`

iVista 可以通过 URL scheme、localhost debug server、WebSocket 或私有 debug menu 调用这些 hooks。

这类能力适合研发本地高频测试，比纯截图点击快很多，也更稳定。

## 12. Recipe 和报告

Recipe 是后续能力，不是当前 MVP 的前置条件。

目标格式可以是：

```yaml
name: create-face-to-face-group
description: Open message page and create a face-to-face group.

app:
  bundleId: com.example.app

target:
  type: simulator
  name: iPhone 17

steps:
  - launchApp: {}
  - checkpoint:
      name: home-loaded
      assert:
        anyOf:
          - text: 消息
          - text: 首页
  - action:
      intent: open message tab
      prefer:
        - byText: 消息
        - byAccessibilityId: message_tab
  - checkpoint:
      name: message-page-loaded
      assert:
        text: 消息
```

报告后续应包含：

- 操作步骤。
- 每一步前后截图。
- WDA source。
- App 日志。
- 系统日志片段。
- 失败原因。
- Agent 观察和建议。

报告格式：

- HTML：给人看。
- JSON：给 Agent 和 CI 解析。
- Markdown：方便贴到 issue 或 PR。

## 13. 里程碑

### M0a：Simulator 操作闭环

状态：基本完成。

交付：

- CLI 能发现和启动 Simulator。
- 能自动下载和缓存 pinned WDA。
- 能在 Simulator 上启动 WDA。
- 能截图、source、点击、输入、滑动、Home。
- 能打开和关闭指定 App。
- 能输出 JSON。
- 能通过 Codex / Claude Code Plugin Skill 指导 Agent 调用 CLI。

待补：

- `wda start` 进度展示继续打磨。
- `doctor` fix hint 继续补常见失败。
- WDA 原生状态 UI 打 tag，升级 CLI 默认 ref。

### M0b：WDA 体验定制

状态：开发中。

交付目标：

- Simulator 上的 WDA App 有 iVista 状态页。
- WDA 启动成功显示 Connected。
- WDA 启动失败显示 Connection failed。
- 端口冲突不直接 crash。
- HTTP `/` 能显示服务状态。
- 打新 tag，例如 `ivista-wda-v0.2.0`。
- 外层 CLI 默认 ref 切到新 tag。

### M1：真机连接技术验证

目标：证明 iVista 可以连接并控制一台本地 iPhone/iPad。

这个阶段可以先使用已经运行的 WDA 做内部验证，但不能把“用户手动准备 WDA”作为对外产品路径。

当前已知状态：

- Xcode 能通过 CoreDevice 发现真机、签名、安装并启动 `iVista-Runner`。
- USB 重新连接并被 `libimobiledevice` 识别后，`idevice_id -l` 可以看到真机 UDID。
- 使用 `ivista wda start --device <udid> --usb --port 8206 --wait 180000` 已验证可以启动真机 WDA。
- `ivista wda status --port 8206`、`ivista screen shot --port 8206` 和 `ivista device info --port 8206` 已在真机上跑通。
- 当前 CLI 曾把已连接设备误判为 `offline`，原因是连接成功时 CoreDevice 暴露的是 `disconnectdevice/installapp/launchapplication` 能力，而不是 `connectdevice`。该判断已在本地开发版本修正。
- 新增 `ivista device diagnose [--device <udid>] [--port <port>]`，用于检查配对、Developer Mode、CoreDevice 连接、无线 tunnel、USB fallback 的 `iproxy`，以及可选 WDA `/status`。
- 暂不要求用户升级 Xcode。后续再单独验证当前 Xcode 版本与目标 iOS 系统版本的兼容性，特别是 iOS 版本高于本机 Xcode 明确支持范围时的 DeviceSupport/CoreDevice 行为。

TODO：

- 发布 `device list --connected` 的真机连接判断修复，优先参考 `devicectl` 的 `pairingState`、`transportType`、`tunnelState` 和可用能力。
- 修正 `--auto-port` 的端口可用性判断，避免 IPv6 或已有 `iproxy` 监听导致误判。
- 在 `wda start --device` 失败时区分三类问题：签名/安装失败、WDA Runner 未启动、端口转发失败。
- 如果 `devicectl` 可见但 `idevice_id -l` 看不到设备，输出明确 fix hint，提示用户重新插线、解锁、信任此电脑，或检查 usbmuxd/libimobiledevice。
- 无线真机路径已验证可通过 CoreDevice tunnel 直接访问 WDA，并有 `device diagnose` 作为用户排障入口，避免用户误以为必须依赖 `iproxy --network`。
- 后续再处理 Xcode/iOS 版本兼容性验证；当前不把升级 Xcode 作为继续开发的前置条件。

交付：

- CLI 能发现真机。
- 能连接真机 WDA。
- 能截图、source、点击、输入、滑动。
- 能打开指定 App。
- 能输出 JSON。

### M2：一键真机 WDA

目标：降低真机首次使用成本。

交付：

- 自动读取 Xcode Team。当前已支持从当前目录或最近的父级 iOS project/workspace 推断。
- 自动配置 WDA bundle id。当前默认使用宿主 bundle id 加 `.ivista.wda`。
- 自动 build/test 启动 WDA。当前已接入 `xcodebuild test`。
- 自动端口转发。USB 真机路径使用 `iproxy`。
- 无线真机路径。当前会识别 `transportType=localNetwork` 和 CoreDevice `tunnelIPAddress`，并直接通过 tunnel 访问 WDA；`--usb` 可强制回到 USB `iproxy`。
- 真机无线诊断。当前 `device diagnose` 会输出 recommended mode、无线 tunnel 状态、WDA status 探测结果和 fix hints。
- `wda start` 能复用已连通 WDA，端口冲突时给修复建议。
- WDA 启动失败时返回结构化 hint，并附带 WDA/iproxy 日志摘要。
- `doctor` 继续补充更完整的真机修复建议。

### M3：Agent 集成增强

目标：让 Codex/Claude Code/Trae 能稳定使用。

交付：

- Skill 文档完善。
- CLI 安装和升级指引。
- 截图和 source 工具稳定。
- 结构化错误。
- Agent 操作报告。
- 可选 MCP server。

### M4：研发工作流

目标：从“能操作手机”变成“能帮研发验收需求”。

交付：

- Recipe 初版。
- 报告系统。
- 日志采集。
- 常见失败恢复。
- App debug hooks adapter。

### M5：规模化

目标：支持团队级使用。

交付：

- 设备池。
- 云端 Mac。
- CI 运行。
- 权限和审计。
- Recipe 资产库。

## 14. 成功标准

### 14.1 开发体验

- Simulator 首次配置不需要处理签名和真机信任。
- 真机首次配置尽量不需要用户手动打开 Xcode 跑 WDA。
- 出错信息能明确告诉用户缺什么。
- 常规启动在 30 秒内完成，已有 WDA 时 5 秒内可用。
- Agent 每次操作都能拿到结构化结果。

### 14.2 测试价值

- 研发可以用一句话跑一个 smoke。
- 失败时能拿到可读报告。
- 对 1 秒 toast 这类短暂状态，可以通过 App hook 或日志捕获，而不是只靠截图碰运气。
- 对高频测试，有明确的非 AI 快路径。

### 14.3 可扩展性

- 可以替换 WDA 启动后端。
- 可以替换视觉模型。
- 可以接入不同 Agent。
- 可以扩展到 iPadOS，未来也可以再评估 Android。

## 15. 风险和应对

### 15.1 WDA 签名仍然复杂

真机上的信任、Developer Mode、Team 权限、Bundle ID 冲突仍然可能失败。

应对：

- `doctor` 做强。
- 错误信息产品化。
- 提供 reset、uninstall、fix hint。
- 后续提供企业内预签名 WDA 包方案。

### 15.2 截图 + AI 慢

纯视觉链路慢，不适合所有测试。

应对：

- 优先 accessibility/source。
- 业务高频链路走 App debug hooks。
- 视觉只用于定位、断言和探索。

### 15.3 Agent 幻觉操作

Agent 可能点错、理解错路径。

应对：

- 每步 checkpoint。
- 高风险操作二次确认。
- Recipe 中沉淀确定性路径。
- 报告记录每一步的依据。

### 15.4 iOS 平台限制

普通 iOS App 不能全局控制其他 App。

应对：

- 明确依赖 Mac/Xcode/WDA 或云端 Mac。
- 不做虚假承诺。
- 如果只测自家 App，提供 App 内 debug hooks 作为快路径。

### 15.5 Simulator 和真机行为差异

Simulator 不能完全代表真机行为，例如相机、推送、蓝牙、部分系统权限、性能、输入法、系统弹窗和硬件相关能力都可能不同。

应对：

- 报告标记 target type。
- Recipe 支持声明 `target.type`。
- Simulator 用于低摩擦验证和快速调试。
- 关键验收和设备相关问题放到真机链路验证。

## 16. 和现有方案的关系

### WDA

iVista 使用 WDA 作为 Simulator 和真机动作执行层之一。

### Appium

Appium 可作为兼容后端，但不作为首期最小依赖。

### go-ios / tidevice

可作为设备管理和 WDA 辅助启动后端。

### Midscene

可作为视觉语义和报告增强 adapter，不作为核心 runtime 必需依赖。

### AXe / agent-mobile

它们证明了“Agent-friendly 手机 CLI”这个方向成立。iVista 应吸收 Simulator 低摩擦路径，同时把差异点放在 Apple 设备研发本地流程、WDA 产品化、诊断报告和后续真机 bootstrap 上。

## 17. 下一步建议

短期优先级：

1. 把当前 WDA 黑色原生状态 UI 收口。
2. 检查 WDA 本地改动，确认无临时文件。
3. 在 `ivista-wda/develop` 提交并打 tag，例如 `ivista-wda-v0.2.0`。
4. 外层 iVista 把默认 WDA ref 从 `ivista-wda-v0.1.3` 升到新 tag。
5. 发新的 CLI 版本。
6. 让用户用默认 `ivista wda prepare/start` 验证，不再需要 `--wda-path`。

随后：

1. 继续优化 `wda start` 进度条和错误提示。
2. 补 `doctor` 常见失败 fix hint。
3. 做真机连接验证。
4. 做报告雏形。
5. 做 recipe 雏形。
6. 评估是否需要 MCP。

## 18. 新对话快速恢复

如果后续重开对话，可以让 Agent 先读这个文件，然后确认以下事实。

### 18.1 当前仓库

```bash
cd /Users/bytedance/Downloads/GitHub/ivista
git status --short
git -C ivista-wda status --short --branch
```

### 18.2 当前 CLI 关键事实

```bash
node bin/ivista.mjs version
node bin/ivista.mjs --help
node bin/ivista.mjs doctor
```

### 18.3 当前 WDA fork 关键事实

```bash
git -C ivista-wda remote -v
git -C ivista-wda branch --show-current
git -C ivista-wda tag --list "ivista-wda-*"
```

### 18.4 本地 WDA UI 验证命令

如果当前机器仍有之前那个 Simulator，可用：

```bash
node bin/ivista.mjs wda start \
  --wda-path /Users/bytedance/Downloads/GitHub/ivista/ivista-wda \
  --simulator 1A8B8BD6-441C-4A44-89FC-32D336744975 \
  --port 8305 \
  --wait 120000

curl http://127.0.0.1:8305/status

xcrun simctl launch \
  1A8B8BD6-441C-4A44-89FC-32D336744975 \
  com.facebook.WebDriverAgentRunner.xctrunner
```

截图检查可用：

```bash
xcrun simctl io 1A8B8BD6-441C-4A44-89FC-32D336744975 screenshot /tmp/ivista-wda-ui.png
```

预期：

- Simulator 上出现黑色 iVista / WebDriverAgent 状态页。
- 状态为 Connected。
- 显示 endpoint。
- `curl /status` 返回 WDA ready。

### 18.5 不要误判的点

- 外层 iVista repo 和内层 `ivista-wda` repo 是两个 Git 仓库。
- 外层 repo 忽略 `ivista-wda/`，不会把 WDA 源码打进外层 git。
- npm/Plugin 用户不会下载外层工作区里的 `ivista-wda/`。
- 用户首次使用 CLI 时，CLI 会下载 pinned WDA ref 到 `~/.ivista/cache/webdriveragent/<ref>/`。
- 当前默认 ref 是 `ivista-wda-v0.1.3`。
- 后续 WDA UI 改动需要新 tag 才会进入默认用户路径。
- XCTest runner 产物名很可能显示为 `iVista-Runner`，不应承诺已经是纯 `iVista`。

## 19. 当前推荐结论

当前最合理的产品路线是：

```text
CLI-first
  -> Simulator-first
  -> WDA 自动缓存和启动
  -> Codex / Claude Code Plugin 做 thin Skill
  -> WDA fork 做少量产品化定制
  -> 打 tag 固定 WDA 版本
  -> 再推进真机 bootstrap、recipe、report、可选 MCP
```

最重要的原则：

- 不让用户手动下载 WDA 工程。
- 不把 WDA 源码塞进 Plugin 或 npm 包。
- 不用 Midscene 作为核心底座。
- 先把 WDA 这只“手”做稳，再让 Agent 这个“脑”更好用。
