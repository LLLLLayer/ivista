# 开发

[English](development.md)

## 本地检查

```bash
npm install
npm run check
npm run check:release
npm run doctor
```

从 checkout 直接运行 CLI：

```bash
node bin/ivista.mjs version
node bin/ivista.mjs simulator list
node bin/ivista.mjs --help
```

## 打包检查

发版或调整打包内容前：

```bash
npm pack --dry-run
```

包里应该包含 CLI、运行时源码、脚本、公开 docs 和 plugin bundle。不应该包含被忽略的 `ivista-wda/` checkout 或 `docs/private/` 规划文档。

## WebDriverAgent Checkout

WDA fork 保持为独立且被忽略的 checkout：

```text
ivista/
  ivista-wda/  # 独立 git repo，被本 repo 忽略
```

CLI 默认会在运行时下载固定版本的 WDA fork。只有本地开发 WDA 时才使用 `--wda-path ./ivista-wda`。

## 文档

- README 聚焦产品概览和快速开始。
- 命令细节放到 `docs/cli.md` 和 `docs/cli.zh-CN.md`。
- 排查问题和开发说明放到独立公开 docs。
- 长期规划上下文放到 `docs/private/`。

## 发版

版本号、tag、打包检查和发版命令使用本项目的 release skill：

```text
ivista-release
```
