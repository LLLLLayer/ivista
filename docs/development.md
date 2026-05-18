# Development

[简体中文](development.zh-CN.md)

## Local Checks

```bash
npm install
npm run check
npm run check:release
npm run doctor
```

Run the CLI from the checkout:

```bash
node bin/ivista.mjs version
node bin/ivista.mjs simulator list
node bin/ivista.mjs --help
```

## Package Checks

Before release or packaging changes:

```bash
npm pack --dry-run
```

The package should include the CLI, runtime source, scripts, public docs, and plugin bundle. It should not include the ignored `ivista-wda/` checkout or `docs/private/` planning notes.

## WebDriverAgent Checkout

Keep the WDA fork as a separate ignored checkout:

```text
ivista/
  ivista-wda/  # separate git repo, ignored by this repo
```

The CLI default path downloads the pinned WDA fork at runtime. Use `--wda-path ./ivista-wda` only for local WDA development.

## Documentation

- Keep README focused on the product overview and quick start.
- Put command details in `docs/cli.md` and `docs/cli.zh-CN.md`.
- Put troubleshooting and development notes in dedicated public docs.
- Keep long-running planning context under `docs/private/`.

## Release Notes

Use the local release skill for version bumps, tags, package checks, and release commands:

```text
ivista-release
```
