# 开源软件使用说明

本文说明 iVista 项目自身的开源许可、默认下载的 WebDriverAgent 依赖，以及本项目没有打包但会调用的本机工具。

## iVista

iVista 主项目采用 MIT License，详见仓库根目录 [LICENSE](../LICENSE)。

MIT License 允许用户在保留版权声明和许可文本的前提下使用、复制、修改、合并、发布、分发、再授权或销售本软件副本。本项目按 “AS IS” 提供，不提供任何明示或暗示担保。

## WebDriverAgent

iVista 默认会在运行时下载并缓存固定版本的 iVista WebDriverAgent fork：

- 仓库：`https://github.com/LLLLLayer/ivista-wda.git`
- 默认 ref：`ivista-wda-v0.1.0`
- 默认缓存目录：`~/.ivista/cache/webdriveragent/<ref>/`

WebDriverAgent 不打包进 iVista npm 包，也不放进 Codex Plugin bundle。它是独立仓库、独立版本、独立许可证的开源项目。使用、修改、分发 WebDriverAgent 时，应遵守 `ivista-wda` 仓库内的许可文件和上游依赖说明。

当前 `ivista-wda` fork 基于 Appium WebDriverAgent。该项目仓库内包含 WebDriverAgent 自身的 license 文件，以及 `WebDriverAgentLib/Vendor` 中第三方代码的许可信息。发布定制版 WDA 或二进制产物时，应一并保留相应版权声明、许可证文本和第三方声明。

## 本机工具和平台依赖

iVista 会调用用户本机已经安装的工具和平台能力：

- Xcode / `xcodebuild`
- `xcrun simctl`
- Git
- Node.js / npm

这些工具不随 iVista 分发。用户需要自行安装并遵守各工具和平台的许可条款。Apple Xcode、iOS Simulator 和相关 SDK 受 Apple 许可协议约束。

## Codex Plugin

`plugins/ivista/` 是 skill-only Codex Plugin。它只包含 plugin manifest、Skill 文档和 plugin 说明，不包含 CLI runtime，也不包含 WebDriverAgent 源码。

CLI runtime 位于仓库根目录：

- `bin/ivista.mjs`
- `src/ivista-runtime.mjs`

这种结构的目的，是让 Plugin 保持轻量，只负责教 Agent 如何安装和调用 CLI；真正的可执行能力由 npm CLI 包提供。

## 分发注意事项

如果你基于 iVista 做二次分发，建议至少保留：

- iVista 的 [LICENSE](../LICENSE)。
- 本开源软件使用说明。
- `package.json` 中的 license 字段。
- 若一并分发或缓存 WebDriverAgent，则保留 `ivista-wda` 仓库中的许可证和第三方声明。

如果你只通过 `ivista wda prepare/start` 在用户本机下载 WDA，而不把 WDA 打包进自己的产物，则仍应在文档中说明 WDA 的下载来源、默认 ref 和许可证位置。

## 免责声明

本文只是项目维护层面的开源软件使用说明，不构成法律意见。涉及商业分发、企业合规或再授权时，请由具备资质的法律或开源合规专业人员进行审查。
