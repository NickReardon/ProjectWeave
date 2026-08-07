# Plugin Release and Testing Plan

## Purpose

This operational plan covers local branch testing, BRAT previews, stable
GitHub releases, and Obsidian Community Plugins publication. It does not claim
that Project Weave is ready to release. Release readiness remains governed by
[Design 13](../spec/13-quality-and-release.md) and the evidence and outstanding
checks in [CURRENT_WORK.md](../CURRENT_WORK.md).

## Channels

| Channel | Audience | Installed files come from | Update path |
| --- | --- | --- | --- |
| Local test vault | Developer | Current checkout's verified export | `npm run test-vault:update` |
| BRAT preview | Invited testers and test devices | GitHub prerelease built from an explicit ref | BRAT |
| Community stable | General users | Stable GitHub release matching the default branch | Obsidian |

Every channel installs exactly `main.js`, `manifest.json`, and `styles.css`.
A ZIP can accompany a release for manual installation, but BRAT and Obsidian
need the three files as individual release assets.

## Release sequence

1. Complete the disposable-vault UI checks in `CURRENT_WORK.md`.
2. Test Obsidian 1.8.0 and current stable desktop/mobile versions.
3. Merge accepted behavior to `main`.
4. Establish the public repository, license, author, support path, changelog,
   and privacy/security disclosures.
5. Exercise the BRAT preview channel.
6. Publish a stable release from an accepted `main` commit.
7. Submit the repository through the Obsidian Community directory.

Preview distribution does not waive any compatibility or safety gate.

## Local test vault

### Configure once

Use only a disposable vault that already has an `.obsidian` directory. Put
its absolute root path in the Git-ignored `.project-weave-test-vault` file:

```text
D:\Path\To\Disposable Vault
```

Alternatively, set `PROJECT_WEAVE_TEST_VAULT`. The environment variable takes
precedence over the file. Never commit a personal vault path or vault files.

### Update from the current branch

```shell
npm run test-vault:update
```

This command checks synchronized versions, builds the production bundle,
verifies its exact inventory, regenerates `export/project-weave/` and the ZIP,
and copies the three runtime files to:

```text
<vault>/.obsidian/plugins/project-weave/
```

It fails if no vault is configured or the root lacks `.obsidian`. It creates
the plugin directory when needed and preserves `data.json` and other local
plugin state. `npm run export` keeps its existing optional behavior: it makes
artifacts and installs when configured, but succeeds without a configured
vault. `npm run release` first runs the complete automated gate.

Local testing loop:

1. Check out the branch or commit.
2. Run `npm run test-vault:update` and confirm the reported destination.
3. Reload Obsidian or disable and re-enable Project Weave.
4. Perform focused manual checks and confirm passive behavior changed no
   Markdown.
5. Record release-relevant evidence or defects in `CURRENT_WORK.md`.

## BRAT preview channel

Obsidian has no official beta channel and recommends BRAT for beta testing.
Current BRAT versions install from GitHub release assets, not raw branch
contents. Do not add the legacy `manifest-beta.json` mechanism.

- [Obsidian beta-testing guidance](https://docs.obsidian.md/Plugins/Releasing/Beta-testing%20plugins)
- [BRAT developer guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)

### Planned preview action

Add a manually dispatched GitHub Actions workflow with:

- `ref`: branch, tag, or commit SHA to build;
- `target_version`: intended stable version, for example `0.4.0`.

The action must:

1. Check out and record the exact commit.
2. Run `npm ci`, the complete gate, and the ordinary export.
3. Derive a unique version such as `0.4.0-beta.27`.
4. Stamp that version only into the generated release manifest. Do not change
   the tracked stable version files on the tested branch.
5. Require the release tag, release name, and released manifest version to
   match.
6. Create a GitHub prerelease containing the three individual assets.
7. Record the source ref, SHA, validation result, and test focus in its notes.

Maintain one moving preview channel. Competing “latest” prereleases from
unrelated branches make BRAT selection ambiguous. Freeze BRAT to an exact tag
or use a manually installed CI artifact for one-off comparison builds.

### Tester procedure

1. Install and enable BRAT from Community Plugins.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter the Project Weave repository.
4. Track the latest preview or freeze the install to an exact prerelease.
5. Use BRAT's update command for later builds.
6. Report the prerelease version, SHA, Obsidian version, platform, and
   reproduction steps.

A private repository requires each tester to configure a scoped read-only
GitHub token in BRAT.

### Promote or leave preview

Never promote by moving a tag or replacing assets. Merge the accepted commit
to `main`, set the stable version, rerun every gate, and publish a new release.
Obsidian may not move `X.Y.Z-beta.N` to `X.Y.Z` automatically. BRAT testers
should update through BRAT and remove tracking, or uninstall the preview and
reinstall the Community version. Stable users are unaffected.

## Stable GitHub releases

Before the first release:

- create the public GitHub repository and configure `origin`;
- add a license and synchronize `package.json` license metadata;
- set public author metadata in `manifest.json`;
- document installation, support, privacy/security, and known limitations;
- add a changelog covering behavior, schema, compatibility, and migrations;
- protect `main` with the complete CI check;
- add a tag-triggered release action with write permission limited to the
  publication job.

The action must accept only a tag exactly matching the stable
`MAJOR.MINOR.PATCH` in `package.json` and `manifest.json`. It checks out the
tagged commit, runs `npm ci` and `npm run release`, verifies the tag and exact
inventory, creates an immutable release, and uploads the three assets. Stable
tags use `0.3.0`, not `v0.3.0`. Fix a bad release with a higher patch version.

Stable checklist:

1. Start from clean, accepted `main`.
2. Update the changelog and run the appropriate `npm run version:*` command.
3. Commit version metadata and documentation together.
4. Run `npm ci`, `npm run check`, and `npm run test-vault:update`.
5. Complete and record minimum/current desktop/mobile manual checks.
6. Push the exact version tag.
7. Verify the release assets by installing them into a clean disposable vault.

## Obsidian submission and later updates

For the first submission, sign in at
[community.obsidian.md](https://community.obsidian.md), link the GitHub owner,
select **Plugins → New plugin**, and submit the repository URL. The
default-branch manifest must identify an existing release with the three
individual assets. Follow the
[official submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).

Address review changes with a new version and release. After acceptance, no
directory resubmission is needed:

```text
accepted change on main
  -> changelog and version
  -> automated and manual gates
  -> exact version tag and matching GitHub release
  -> Obsidian offers the update
```

## Completion criteria

- Local update fails closed and is verified against a disposable vault.
- BRAT previews come from an explicit SHA without advancing the stable
  default-branch manifest.
- Stable releases cannot publish from mismatched tags or failing checks.
- Every release exposes exactly the runtime files Obsidian expects.
- Community submission waits for recorded compatibility and safety evidence.
