---
name: ivista-release
description: Use this skill when releasing the iVista project, including preparing or publishing a new CLI version, updating the pinned ivista-wda ref, tagging or pushing the ivista-wda fork, packing the npm git package, verifying package contents, or giving the user cleanup and installation commands for a new iVista release.
---

# iVista Release

This skill releases the iVista project. iVista has two related repositories:

- Outer CLI/plugin/docs repo: project root, remote `git@github.com:LLLLLayer/ivista.git`.
- WDA fork: `ivista-wda/`, remote `git@github.com:LLLLLayer/ivista-wda.git`.

The npm package must not include the `ivista-wda/` checkout. The outer package should only include `bin`, `src`, `plugins/ivista`, `docs`, `.agents/plugins/marketplace.json`, package metadata, README files, and LICENSE.

## Release Order

1. Inspect both worktrees:

```bash
git status --short --branch
git -C ivista-wda status --short --branch
```

2. If WDA changed, release WDA first:

```bash
git -C ivista-wda branch --show-current
xcodebuild -project ivista-wda/WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner -destination 'generic/platform=iOS Simulator' build-for-testing
git -C ivista-wda add <changed WDA files>
git -C ivista-wda commit -m "<message>"
git -C ivista-wda tag ivista-wda-vX.Y.Z
git -C ivista-wda push origin develop
git -C ivista-wda push origin ivista-wda-vX.Y.Z
```

WDA branch should normally be `develop`. Do not tag WDA before the Xcode build passes. Xcode analyzer/localization warnings are acceptable if the build succeeds.

3. Update the outer CLI release:

- Bump `package.json` version.
- Bump `CLI_VERSION` in `src/cli/constants.mjs`.
- If WDA changed, update `DEFAULT_WDA_REF` in `src/core.mjs`.
- Update help text, README, Chinese README, project planning docs, plugin docs, and skill references that mention the old CLI version or WDA ref.

Useful search:

```bash
rg -n "0\\.1\\.|v0\\.1\\.|ivista-wda-v" package.json bin src README.md README.zh-CN.md docs plugins
```

4. Validate the outer repo:

```bash
npm run check
git diff --check
npm pack --dry-run
```

Confirm dry-run package contents. `ivista-wda/` must not appear.

5. Commit, tag, and push the outer repo:

```bash
git add <changed outer files>
git commit -m "Release ivista X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

6. Create and verify a tarball without dirtying the repo root:

```bash
mkdir -p /tmp/ivista-release
npm pack --pack-destination /tmp/ivista-release
npm install -g --prefix /tmp/ivista-install /tmp/ivista-release/ivista-X.Y.Z.tgz
/tmp/ivista-install/bin/ivista version
/tmp/ivista-install/bin/ivista --help
```

7. Verify GitHub tag installation:

```bash
npm install -g --prefix /tmp/ivista-git-install git+https://github.com/LLLLLayer/ivista.git#vX.Y.Z
/tmp/ivista-git-install/bin/ivista version
```

## User Cleanup And Install Commands

For the user to replace an old global install with the new release:

```bash
npm uninstall -g ivista
hash -r
npm install -g git+https://github.com/LLLLLayer/ivista.git#vX.Y.Z
ivista version
ivista doctor
```

If a local tarball was produced and the user is on the same machine:

```bash
npm uninstall -g ivista
hash -r
npm install -g /tmp/ivista-release/ivista-X.Y.Z.tgz
ivista version
ivista doctor
```

To force a fresh WDA download for the new pinned ref:

```bash
rm -rf ~/.ivista/cache/webdriveragent/ivista-wda-vX.Y.Z
ivista wda prepare
ivista wda cache status
```

Explain that `rm -rf` recursively deletes the exact target without prompting. Only suggest the narrow cache path, never a broad parent directory.

## Final Response

Summarize:

- Outer commit/tag/push state.
- WDA commit/tag/push state, if WDA was released.
- Validation commands run and any warnings.
- Tarball path, if created.
- Exact cleanup and install commands for the user.

Only emit Git directives after the matching git action actually succeeded.
