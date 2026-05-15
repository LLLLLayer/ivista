# iVista 规划文档

## 1. 定位

iVista 是一个面向 Apple 设备的 Agent-native 本地测试与设备操作层，首期支持 iOS Simulator 和 iOS/iPadOS 真机。

它不直接做“另一个 Midscene”，也不把核心价值押在单次大模型规划上。iVista 的核心目标是把 Simulator/真机控制、WDA 启动、截图理解、操作执行、日志采集、报告生成、失败恢复这些能力封装成一套研发可以低成本使用的工具链。

一句话定位：

> iVista turns an iOS Simulator, iPhone, or iPad into an Agent-operable test surface.

中文理解：

> 让研发用一句话、一个脚本或一个 Agent，对本地 Simulator 或 iPhone/iPad 做可观察、可回放、可诊断的真实操作。

首期应该明确把 Simulator 作为最快技术验证路径：

- Simulator 不需要处理真机信任、Developer Mode、Team 签名、证书权限和 `iproxy`。
- Simulator 可以更快验证 CLI、WDA Client、截图、source、tap/input/swipe、App 启停等核心闭环。
- 真机仍然是 iVista 的关键差异点，但一键真机 WDA bootstrap 可以放到 Simulator 闭环之后推进。

## 2. 核心判断

### 2.1 WDA 是手，不是脑

WDA 负责底层设备控制：启动 App、截图、获取元素树、点击、输入、滑动、Home、等待等。

WDA 不负责理解“打开消息页面创建一个群聊”这种业务目标，也不负责报告、失败归因、上下文压缩、调试体验。

iVista 要补的是 WDA 之上的产品层和 Agent 层。

### 2.2 Midscene 可选，不是底座

Midscene 的价值在于视觉语义动作、断言、YAML、报告和跨端抽象。但在 Codex、Claude Code、Trae、Cursor 这类宿主 Agent 场景里，Agent 自己已经具备语言理解和多模态推理能力。

因此 iVista 不应该强依赖 Midscene。更合理的方式是：

- 核心能力走自有 CLI 和 WDA 封装。
- 视觉断言、AI 查询、报告增强可以做 Midscene adapter。
- 宿主 Agent 有模型时，优先复用宿主 Agent 的能力。
- 没有宿主多模态能力时，再接外部视觉模型。

### 2.3 高频测试不应该依赖 AI 慢慢点

iVista 不替代单元测试、状态测试、接口 mock、自动化回归和确定性 UI 测试。

它适合补充这些场景：

- 研发本地验收复杂链路。
- 一句话 smoke test。
- 复现和诊断移动端问题。
- 生成带截图、日志、操作步骤的调试报告。
- 探索式测试和异常路径发现。
- 将“我刚开发的需求”快速跑一遍真实设备体验。

## 3. 目标用户

### 3.1 一线客户端研发

他们需要的是：

- 不想理解 WDA、签名、iproxy、xcodebuild 细节。
- 不想手动打开 Xcode 跑 WebDriverAgent。
- 希望开发完后用自然语言或命令跑一次真实设备验收。
- 出问题时希望拿到截图、日志、当前页面结构和复现步骤。

### 3.2 Agent 用户

他们可能使用：

- Codex
- Claude Code
- Trae
- Cursor
- 其他带 MCP 或 Shell 能力的本地 Agent

他们需要的是一套稳定、结构化、低摩擦的手机操作工具，而不是只能在某一个 Agent 内工作的脚本。

### 3.3 测试和质量团队

他们需要：

- 把研发口语化验收流程转成可复用 recipe。
- 在本地、CI 或设备池里运行 smoke test。
- 获取结构化报告。

## 4. 不做什么

首期明确不做：

- 不做 iOS 无宿主自操作。普通 iOS App 不能全局控制其他 App。
- 不承诺脱离 Mac 启动 WDA。真机 WDA 的标准链路仍然需要 Mac/Xcode 或云端 Mac。
- 不把“AI 自动探索所有业务路径”作为首期核心卖点。
- 不把慢速截图大模型链路用于高频回归测试。
- 不强绑 Midscene、Appium、go-ios、tidevice 中任意一个实现。
- 不把 Simulator 能力包装成真机等价能力。Simulator 是低摩擦验证和研发调试路径，真机用于真实设备行为验证。

## 5. 产品形态

iVista 应该由四层组成。

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
Backends: WDA / Simulator / xcodebuild / go-ios / tidevice / App Hooks / Midscene
        |
        v
iOS Simulator / iPhone / iPad
```

### 5.1 CLI

CLI 是核心运行时入口，也是最容易被各种 Agent 复用的接口。

建议命令名：

```bash
ivista
```

核心命令：

```bash
ivista doctor
ivista device list
ivista simulator list
ivista simulator boot
ivista device status
ivista wda bootstrap
ivista wda start
ivista wda stop
ivista app launch --bundle-id com.example.app
ivista app terminate --bundle-id com.example.app
ivista screen shot
ivista screen source
ivista act tap --x 120 --y 500
ivista act input "hello"
ivista act swipe --direction up
ivista act home
ivista logs stream
ivista report start
ivista report append
ivista report finish
ivista recipe run ./recipes/create-group.yaml
```

所有 Agent 友好命令都必须支持：

```bash
--json
--udid <device-udid>
--simulator <simulator-udid-or-name>
--timeout <ms>
--verbose
```

WDA 工程默认由 iVista 自动管理，用户不需要手动下载。`ivista wda start` 应该在缓存缺失时自动拉取 pinned WDA 版本，并把它放到本地缓存目录。只有高级场景才需要显式指定：

```bash
ivista wda start --simulator "iPhone 16" --wda-path /path/to/WebDriverAgent
```

`--wda-path` 只服务于离线环境、企业内 fork、调试 WDA 本身等场景，不应该成为新用户的必经步骤。

### 5.2 Plugin Skill

首期 Codex Plugin 不直接暴露 MCP tools，而是提供 Skill，指导 Agent 安装和调用 `ivista` CLI。

原因：

- 用户和 Agent 使用同一个入口，调试路径更简单。
- 终端、CI、Codex 都可以复用同一组命令。
- Plugin 不需要携带额外 MCP server 生命周期和路径解析复杂度。

Skill 默认流程：

```bash
command -v ivista || npm install -g git+https://github.com/LLLLLayer/ivista.git#v0.1.4
ivista update
ivista doctor
ivista simulator list
ivista simulator boot --name "iPhone 16"
ivista wda start --simulator "iPhone 16"
ivista screen shot --json
```

MCP 可以作为后续可选入口，但不进入首期 MVP。

### 5.3 Skill

Skill 是给宿主 Agent 的操作说明书，告诉 Agent：

- 遇到 iOS Simulator 或 iOS/iPadOS 真机任务时优先用 iVista。
- 如何先跑 `ivista doctor`。
- 如何连接设备和确认 WDA 状态。
- 如何边看截图边执行。
- 什么时候用确定性命令，什么时候用视觉判断。
- 如何生成报告。

Skill 不放大段业务逻辑，不内置所有路径。它应该指导 Agent 使用工具，而不是替 Agent 做所有决策。

### 5.4 Recipe

Recipe 是可复用业务流程。

它适合沉淀研发常用验收动作，比如：

- 打开 App 并进入消息页。
- 创建群聊。
- 发送一条消息。
- 检查某个入口是否可见。
- 验证某个 toast、弹窗或页面状态。

Recipe 不是纯 AI plan，而是“确定性步骤 + 视觉/状态断言 + 失败恢复”。

示例：

```yaml
name: create-face-to-face-group
description: Open message page and create a face-to-face group.

app:
  bundleId: com.example.app

target:
  type: simulator
  name: iPhone 16

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

  - action:
      intent: create face-to-face group
      strategy:
        - byKnownPath: douyin.createFaceToFaceGroup
        - byVision: true

  - action:
      input: "4583"

  - checkpoint:
      name: group-created
      assert:
        anyOf:
          - text: 进入群聊
          - text: 面对面建群
```

## 6. Runtime 模块设计

### 6.1 Device Manager

负责：

- 发现设备。
- 发现 Simulator。
- 读取设备名称、UDID、系统版本。
- 区分 `simulator` 和 `real-device`。
- 选择默认设备。
- 对真机检测设备信任状态。
- 对真机检测是否需要 Developer Mode。
- 输出人类可读和 JSON 两种状态。

### 6.2 WDA Manager

负责：

- 自动管理 WDA 工程，不要求用户手动下载。
- 首次使用时下载 pinned WDA 版本到本地缓存。
- 校验缓存完整性和版本，必要时自动更新或重建。
- 支持用户显式指定已有 WDA 工程作为高级入口。
- 判断目标是 Simulator 还是真机。
- 对 Simulator，使用 Xcode/simctl/xcodebuild 启动 WDA，不做真机签名和端口转发复杂流程。
- 自动读取上层 Xcode 项目的 Team。
- 生成 WDA Runner bundle id。
- 构建 WDA。
- 安装并启动 WDA。
- 对真机启动端口转发。
- 轮询 `/status`。
- 记录进程和端口状态。
- 停止、重启、清理 WDA。

WDA 启动流程：

Simulator：

```text
detect simulator
  -> boot simulator if needed
  -> detect Xcode
  -> resolve cached WDA project
  -> download pinned WDA if cache missing
  -> xcodebuild test against simulator destination
  -> poll /status
  -> persist session
```

真机：

```text
detect device
  -> detect Xcode
  -> detect team id
  -> resolve cached WDA project
  -> download pinned WDA if cache missing
  -> configure bundle id and signing
  -> xcodebuild test
  -> start iproxy
  -> poll /status
  -> persist session
```

### 6.3 WDA Client

负责封装 WDA HTTP 接口：

- status
- screenshot
- source
- tap
- type
- swipe
- home
- app launch
- app terminate
- element query

WDA Client 只做确定性动作，不做 AI 推理。

### 6.4 Vision Layer

负责屏幕理解。

可以有多个实现：

- 宿主 Agent 视觉能力。
- Midscene adapter。
- 外部 OpenAI-compatible vision model。
- OCR + accessibility tree 混合。

输出应该是结构化候选目标：

```json
{
  "intent": "tap message tab",
  "candidates": [
    {
      "label": "消息",
      "x": 341,
      "y": 812,
      "confidence": 0.91,
      "source": "accessibility"
    }
  ]
}
```

### 6.5 Recipe Engine

负责执行流程：

- 加载 YAML recipe。
- 执行确定性动作。
- 调用视觉定位。
- 调用断言。
- 失败时截图、拉日志、生成上下文。
- 支持重试和恢复。

### 6.6 Report Manager

负责生成调试报告：

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

## 7. 一线研发本地流程

### 7.1 首次配置

Simulator 路径：

```bash
ivista doctor
ivista simulator list
ivista simulator boot --name "iPhone 16"
ivista wda start --simulator "iPhone 16"
```

真机路径：

```bash
ivista doctor
ivista wda bootstrap --project /path/to/App.xcodeproj --scheme App
ivista wda start
```

期望体验：

- Simulator 路径自动找到或启动 Simulator。
- 自动下载、缓存和复用 pinned WDA。
- 真机路径自动找到设备。
- 真机路径自动读取 Team。
- 真机路径自动配置 WDA 签名。
- 自动启动 WDA。
- 真机路径自动打开端口转发。
- 失败时告诉用户缺什么，不让用户去猜。

### 7.2 日常使用

```bash
ivista wda start
ivista app launch --bundle-id com.example.app
ivista recipe run ./recipes/smoke.yaml
```

或者在 Agent 里说：

```text
用 iVista 打开我的 App，进入消息页，创建一个面对面群聊，然后生成报告。
```

Agent 执行方式：

```bash
ivista wda status --json
ivista app launch --bundle-id com.example.app
ivista screen shot --json
  -> reason about next action
ivista act tap/input/swipe
  -> checkpoint
  -> report
```

### 7.3 高频测试建议

高频测试不要依赖 AI 每一步截图思考。

建议分层：

- 单元测试覆盖纯逻辑。
- 状态测试覆盖 ViewModel / Store / Reducer。
- Mock server 覆盖接口组合。
- App 内 debug hooks 覆盖深链路跳转和状态注入。
- iVista 覆盖真实设备 smoke、复杂链路验收、异常复现和报告。

## 8. App 内 Debug Hooks

如果只能控制自家 App，建议同时建设 App 内调试通道，降低对 WDA 的依赖。

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

## 9. 技术选型建议

### 9.1 首期推荐

- 语言：TypeScript / Node.js
- CLI：commander 或 cac
- Plugin：Skill-only，负责安装和调用 CLI
- WDA：自研 HTTP client
- WDA 启动：Simulator 使用 `simctl` + `xcodebuild`，真机使用 `xcodebuild` + `iproxy`
- 配置：JSON/YAML
- 报告：HTML + JSON + Markdown

原因：

- Agent 生态对 Node CLI 友好。
- Skill-only plugin 更轻，避免首期同时维护 CLI 和 MCP 两套入口。
- 与 Midscene、前端工具链、npm 分发天然接近。

WDA 依赖管理：

- 默认使用 iVista 固定的 pinned WDA git ref。
- 当前插件原型默认使用 Appium WebDriverAgent `v9.15.3`。
- 首次启动时自动下载到 `~/.ivista/cache/webdriveragent/<ref>/`。
- 缓存 key 应包含 WDA ref、Xcode 版本和必要构建配置。
- 提供 `ivista wda cache list/clear/update` 管理缓存。
- 企业内可以通过配置把 WDA 下载源替换成内部 Git 或制品镜像。
- `--wda-path` 只作为 escape hatch，不作为默认使用路径。

### 9.2 可选后端 adapter

- `simulator-adapter`：基于 `simctl` 管理 Simulator 的发现、启动、安装、日志和状态。
- `xcodebuild-adapter`：默认真机 WDA 启动。
- `go-ios-adapter`：设备发现、安装、启动、日志、WDA 辅助。
- `tidevice-adapter`：轻量设备命令和 wda proxy。
- `appium-adapter`：兼容成熟 Appium 生态。
- `midscene-adapter`：AI 断言、查询、报告增强。
- `debug-hook-adapter`：调用 App 内测试 hooks。

## 10. 项目结构建议

```text
ivista/
  packages/
    cli/
    runtime/
    skill/
    report/
    recipes/
    adapters/
      wda/
      simulator/
      xcodebuild/
      go-ios/
      tidevice/
      appium/
      midscene/
      debug-hooks/
  examples/
    recipes/
    reports/
  docs/
    getting-started.md
    wda-bootstrap.md
    agent-integration.md
    recipe-format.md
```

## 11. MVP 范围

### 11.1 MVP 必须有

- `ivista doctor`
- `ivista simulator list`
- `ivista simulator boot`
- `ivista device list`
- 自动下载和缓存 pinned WDA
- `ivista wda start --simulator`
- `ivista wda stop`
- `ivista device status`
- `ivista screen shot --json`
- `ivista screen source --json`
- `ivista act tap/input/swipe`
- `ivista app launch/terminate`
- Codex/Claude Code 可用的 Skill 文档，负责安装和调用 CLI
- 基础 HTML/Markdown 报告

MVP 的推荐验证顺序是先完成自动管理 WDA 的 Simulator，再做真机连接验证：

- Simulator WDA：自动下载/缓存 WDA，验证 runtime、CLI、截图、source 和动作执行。
- Real-device connection：内部可以先连接一台已经运行 WDA 的真机，验证真机控制链路。
- Real-device bootstrap：对外能力再补自动签名、构建、端口转发和修复建议。

### 11.2 MVP 可以暂缓

- 复杂 YAML recipe engine。
- Midscene adapter。
- Appium adapter。
- 云端 Mac/device farm。
- Android 支持。
- 自动探索式测试。
- 一键真机 WDA bootstrap 的完整自动修复能力。

## 12. 里程碑

### M0a：Simulator 技术验证

目标：证明 iVista 可以稳定控制一台本地 iOS Simulator。

交付：

- CLI 能发现和启动 Simulator。
- 能自动下载和缓存 pinned WDA。
- 能在 Simulator 上启动 WDA。
- 能截图、点击、输入、滑动。
- 能打开指定 App。
- 能输出 JSON。

### M0b：真机连接技术验证

目标：证明 iVista 可以连接并控制一台本地 iPhone/iPad。这个阶段可以先使用已经运行的 WDA 做内部验证，但不能把“用户手动准备 WDA”作为对外产品路径。

交付：

- CLI 能发现真机。
- 能连接真机 WDA。
- 能截图、点击、输入、滑动。
- 能打开指定 App。
- 能输出 JSON。

### M1：一键 WDA

目标：降低真机首次使用成本。

交付：

- 自动读取 Xcode Team。
- 自动配置 WDA bundle id。
- 自动 build/test 启动 WDA。
- 自动端口转发。
- `doctor` 能给出清晰修复建议。

### M2：Agent 集成

目标：让 Codex/Claude Code/Trae 能直接用。

交付：

- Skill 文档。
- CLI 安装和升级指引。
- 截图和 source 工具。
- 结构化错误。
- Agent 操作报告。

### M3：研发工作流

目标：从“能操作手机”变成“能帮研发验收需求”。

交付：

- Recipe 初版。
- 报告系统。
- 日志采集。
- 常见失败恢复。
- App debug hooks adapter。

### M4：规模化

目标：支持团队级使用。

交付：

- 设备池。
- 云端 Mac。
- CI 运行。
- 权限和审计。
- Recipe 资产库。

## 13. 成功标准

### 13.1 开发体验

- Simulator 首次配置不需要处理签名和真机信任。
- 真机首次配置尽量不需要用户手动打开 Xcode 跑 WDA。
- 出错信息能明确告诉用户缺什么。
- 常规启动在 30 秒内完成，已有 WDA 时 5 秒内可用。
- Agent 每次操作都能拿到结构化结果。

### 13.2 测试价值

- 研发可以用一句话跑一个 smoke。
- 失败时能拿到可读报告。
- 对 1 秒 toast 这类短暂状态，可以通过 App hook 或日志捕获，而不是只靠截图碰运气。
- 对高频测试，有明确的非 AI 快路径。

### 13.3 可扩展性

- 可以替换 WDA 启动后端。
- 可以替换视觉模型。
- 可以接入不同 Agent。
- 可以扩展到 iPadOS 和未来 Android。

## 14. 风险

### 14.1 WDA 签名仍然复杂

即使自动化，首次信任、Developer Mode、Team 权限、Bundle ID 冲突仍然可能失败。

应对：

- `doctor` 做强。
- 错误信息产品化。
- 提供 reset 和 uninstall。
- 提供企业内预签名 WDA 包方案。

### 14.2 截图 + AI 慢

纯视觉链路慢，不适合所有测试。

应对：

- 优先 accessibility/source。
- 业务高频链路走 App debug hooks。
- 视觉只用于定位、断言和探索。

### 14.3 Agent 幻觉操作

Agent 可能点错、理解错路径。

应对：

- 每步 checkpoint。
- 高风险操作二次确认。
- Recipe 中沉淀确定性路径。
- 报告记录每一步的依据。

### 14.4 iOS 平台限制

不能靠普通 App 全局控制其他 App。

应对：

- 明确依赖 Mac/Xcode/WDA 或云端 Mac。
- 不做虚假承诺。
- 如果只测自家 App，提供 App 内 debug hooks 作为快路径。

### 14.5 Simulator 和真机行为差异

Simulator 不能完全代表真机行为，例如相机、推送、蓝牙、部分系统权限、性能、输入法、系统弹窗和硬件相关能力都可能不同。

应对：

- 明确标记报告的 target type。
- Recipe 支持声明 `target.type`。
- 把 Simulator 用于低摩擦验证和快速调试。
- 把关键验收和设备相关问题放到真机链路验证。

## 15. 和现有方案的关系

### WDA

iVista 使用 WDA 作为 Simulator 和真机动作执行层之一。

### Appium

Appium 可作为兼容后端，但不作为首期最小依赖。

### go-ios / tidevice

可作为设备管理和 WDA 辅助启动后端。

### Midscene

可作为视觉语义和报告增强 adapter，不作为核心 runtime 必需依赖。

### AXe / agent-mobile

它们证明了“Agent-friendly 手机 CLI”这个方向是成立的，但主要面向 iOS Simulator。iVista 应该吸收 Simulator 低摩擦路径，同时把差异点放在 iOS/iPadOS 真机研发本地流程和诊断报告上。

## 16. 推荐开工顺序

1. 先做 CLI runtime，不先做漂亮 UI。
2. 先支持 Simulator + WDA 的操作闭环。
3. 再支持真机 WDA 连接的操作闭环。
4. 再做真机 WDA bootstrap。
5. 再写 Skill-only Plugin，让 Agent 安装和调用 CLI。
6. MCP 作为后续可选入口，不进入首期主路径。
7. 最后做 recipe 和报告增强。

这样可以最快验证核心假设：

> Host Agent + iVista CLI + WDA，是否能比 Midscene Playground 更适合一线研发本地测试。
