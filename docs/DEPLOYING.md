# Deploying Aura

This document covers everything you need to ship a new version of Aura to users.

## How It Works

Aura uses **GitHub Releases** as its distribution and update channel:

1. You bump the version and push a git tag (`v0.2.0`)
2. GitHub Actions builds native installers for macOS, Windows, and Linux
3. The built artifacts + a signed `latest.json` manifest are uploaded to a new GitHub Release
4. Installed copies of Aura check `latest.json` on startup and prompt users to update

No app stores, no deploy servers, no infrastructure to manage. Just git tags.

## Step-by-Step: Shipping a Release

### 1. Bump the version

The version lives in **two places** and they must match:


| File                        | Field       |
| --------------------------- | ----------- |
| `src-tauri/tauri.conf.json` | `"version"` |
| `package.json`              | `"version"` |


Update both to the new version (e.g. `0.2.0` -- no `v` prefix in the files).

### 2. Commit the version bump

```bash
git add src-tauri/tauri.conf.json package.json
git commit -m "release: v0.2.0"
```

### 3. Tag and push

```bash
git tag v0.2.0
git push origin main --tags
```

The `v` prefix on the tag is required -- the release workflow triggers on `v*` tags.

### 4. Wait for builds

GitHub Actions will start four parallel jobs:


| Runner           | Target                     | Artifacts                       |
| ---------------- | -------------------------- | ------------------------------- |
| `macos-latest`   | `aarch64-apple-darwin`     | `.dmg` (Apple Silicon)          |
| `macos-latest`   | `x86_64-apple-darwin`      | `.dmg` (Intel)                  |
| `ubuntu-latest`  | `x86_64-unknown-linux-gnu` | `.AppImage`, `.deb`             |
| `windows-latest` | `x86_64-pc-windows-msvc`   | `.exe` (NSIS installer), `.msi` |


Builds typically take 8-15 minutes. Monitor progress at:
[https://github.com/darkw3bb/aura/actions/workflows/release.yml](https://github.com/darkw3bb/aura/actions/workflows/release.yml)

### 5. Done

Once all jobs complete, the release is published automatically at:
[https://github.com/darkw3bb/aura/releases](https://github.com/darkw3bb/aura/releases)

The auto-updater in existing Aura installs will detect the new version within a few minutes.

## Quick Reference

Ship a release in three commands:

```bash
# After bumping version in tauri.conf.json and package.json:
git add -A && git commit -m "release: v0.2.0"
git tag v0.2.0
git push origin main --tags
```

## What Gets Built

Each release automatically includes:

- **Installers**: `.dmg` (macOS), `.exe` NSIS installer (Windows), `.msi` (Windows), `.AppImage` (Linux), `.deb` (Linux)
- **Update manifest**: `latest.json` -- contains the new version number, download URLs, and cryptographic signatures for each platform
- **Signatures**: `.sig` files for each installer, verified by the app before applying updates

## Auto-Update Flow

The updater is configured in `src-tauri/tauri.conf.json` under `plugins.updater`:

- **Endpoint**: `https://github.com/darkw3bb/aura/releases/latest/download/latest.json`
- **Public key**: Embedded in the config, used to verify update signatures

When Aura starts, it waits 3 seconds then fetches `latest.json` from the latest GitHub Release. If a newer version exists, a banner appears at the top of the app. The user clicks "Update & Restart" to download, verify the signature, install, and relaunch.

The signing keypair:

- **Private key**: Stored locally at `~/.tauri/aura.key` and in GitHub Actions as the `TAURI_SIGNING_PRIVATE_KEY` secret
- **Public key**: Stored locally at `~/.tauri/aura.key.pub` and embedded in `tauri.conf.json`

## GitHub Actions Secrets

The release workflow requires two secrets (already configured):


| Secret                               | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Contents of `~/.tauri/aura.key` -- signs update bundles |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key (empty if none)            |


`GITHUB_TOKEN` is provided automatically by GitHub Actions.

If you ever need to regenerate the signing keys:

```bash
npx tauri signer generate -w ~/.tauri/aura.key -p ""
```

Then update:

1. The `pubkey` in `src-tauri/tauri.conf.json`
2. The `TAURI_SIGNING_PRIVATE_KEY` GitHub secret: `gh secret set TAURI_SIGNING_PRIVATE_KEY --repo darkw3bb/aura < ~/.tauri/aura.key`

**Warning**: Changing keys means older installs can't verify updates signed with the new key. Users would need to manually download the new version.

## CI Pipeline

Every push to `main` and every PR runs the CI workflow (`.github/workflows/ci.yml`):

- TypeScript type checking (`tsc --noEmit`)
- Rust `cargo check` across all four platform targets

The release workflow (`.github/workflows/release.yml`) only runs on `v`* tags and does full builds.

## Troubleshooting

**Release workflow failed?**
Check the Actions tab. Common issues:

- Missing `TAURI_SIGNING_PRIVATE_KEY` secret -- re-add it from `~/.tauri/aura.key`
- Rust compilation errors -- fix the code and push a new tag (e.g. `v0.2.1`)

**Users not seeing updates?**

- The updater checks `latest.json` from the **latest** published release. If builds are still running, the old `latest.json` is still served.
- Users only see the update banner after restarting Aura (the check runs 3 seconds after startup).

**Version mismatch?**
If `tauri.conf.json` and `package.json` have different versions, the Tauri build uses `tauri.conf.json`. Always keep them in sync.

**Need to delete a bad release?**

```bash
# Delete the release and tag
gh release delete v0.2.0 --repo darkw3bb/aura --yes
git push origin --delete v0.2.0
git tag -d v0.2.0
```

## Future Enhancements

These are not set up yet but worth considering:

- **macOS code signing + notarization** -- Requires Apple Developer account ($99/yr). Without it, macOS shows "unidentified developer" warnings (users bypass with right-click > Open).
- **Windows code signing** -- Removes "Unknown publisher" SmartScreen warnings. Requires an EV code signing certificate.
- **Automated version bumping** -- Tools like `release-please` or `changesets` can automate the version bump + changelog + tag workflow.

