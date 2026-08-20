---
type: development
area: release
status: current
canonical: false
---

# Plugin Release and Testing Plan

## Purpose

This operational plan covers local branch testing, BRAT previews, stable
GitHub releases, and Obsidian Community Plugins publication. It does not claim
that Project Weave is ready to release. Release readiness remains governed by
[Quality and release](../Specifications/quality-and-release.md), the automated-verification
evidence in [CURRENT_WORK.md](../../../../../CURRENT_WORK.md), and the outstanding manual
checks tracked in [docs/project-vault/](../../../../).

## Merge-ready documentation state

Ordinary branch checks may leave useful text in `docs/CURRENT_WORK.md` while
work is in flight. The complete gate accepts `--merge-ready` for non-draft pull
requests and pushes to `main`; that mode requires the `## In flight` section to
contain exactly `None.`. Historical beta tags and release checksums remain
valid in task notes and release history, but not in the evergreen files checked
by `npm run docs:check`.

## Versioning

`package.json` is the canonical project version. Version commands update it
together with `package-lock.json`, `manifest.json`, and `versions.json`:

```shell
npm run version:show
npm run version:patch
npm run version:minor
npm run version:major
npm run version:set -- 1.2.3
```

Choose the increment by the size of the change, not by how many commits it
took. Before 1.0 the minor position carries feature weight:

- **patch** (`0.3.0` → `0.3.1`) — every exported build that carries changes.
  This is the ordinary increment and the one used most often: fixes,
  refactoring, documentation, tests, and interim work within a slice all land
  here.
- **minor** (`0.3.0` → `0.4.0`) — a numbered slice Epic in the
  [dogfood project roadmap](../../Project.md#implementation-roadmap-v1)
  passing its exit gate,
  or a change to a compatibility surface: product terms, frontmatter fields,
  controlled values, diagnostic codes, or persisted workspace state. Crossing a
  boundary the plugin did not previously cross — the first vault write, for
  example — is always at least a minor bump.
- **major** (`0.4.0` → `1.0.0`) — reserved for the first stable release against
  the full specification and, after that, for breaking changes to a
  compatibility surface.

**Bump the patch before exporting a build that differs from the last exported
one.** A version identifies an installed build, so two builds that behave
differently must never share a number — that is what makes "passed against the
installed 0.5.0 build" on a manual-check task in
[docs/project-vault/](../../../../) mean anything.
Re-running `npm run export` or `npm run test-vault:update` over an unchanged
tree reinstalls the same build and needs no bump; changing source and
reinstalling does.

**Bump the minor when a slice passes its exit gate**, not when work on it
begins. The version describes what a build contains, and a number claimed in
advance promises a capability that is not there yet. The exception is a
compatibility surface: those move when they move, mid-slice or not, because
they describe what a user's notes and settings must look like rather than how
far the roadmap has progressed.

Use all three positions. A project that answers every change with a minor bump
has thrown away the third number and, with it, the ability to tell a release
that adds something from one that repairs it.

Doubt means genuine ambiguity about whether something is a new capability or
touches a compatibility surface — not the mild uncertainty that attends any
judgment call. Resolve that kind of doubt upward: installed builds are
identified by version alone, and a version that undersells a release is worse
than one that oversells it. A change you can fully describe as a fix, a
refactor, or documentation is not in doubt.

The minor position is unbounded before 1.0. `0.9.0` is followed by `0.10.0`,
and `0.13.0` is a perfectly ordinary version — the tooling compares and sorts
each position numerically. Reaching 1.0 is gated on the specification being
complete, never on the minor position running high.

## Channels

| Channel | Audience | Installed files come from | Update path |
| --- | --- | --- | --- |
| Local test vault | Developer | Current checkout's verified export | `npm run test-vault:update` |
| Dogfood vault | Developer | Current checkout's production build | `npm run project-vault:install` |
| BRAT preview | Invited testers and test devices | GitHub prerelease built from an explicit ref | BRAT |
| Community stable | General users | Stable GitHub release matching the default branch | Obsidian |

Every plugin channel installs exactly `main.js`, `manifest.json`, and
`styles.css`. A ZIP can accompany a release for manual installation. The
optional `project-weave-mcp.cjs` companion is separately built, checksummed,
published, installed, and updated.

## Release sequence

1. Complete the disposable-vault UI checks tracked in `docs/project-vault/`.
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
verifies both exact inventories, regenerates `export/project-weave/`, the ZIP,
and `export/companion/`, then copies the three plugin runtime files to:

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
5. Record check results and completed task state in the commit; rewrite
   `CURRENT_WORK.md` to the short state the checkout now leaves behind.

### Update a plugin folder from a tagged GitHub release

For the same artifact path a tester receives, set these ignored `.env` values:

```text
PROJECT_WEAVE_PLUGIN_PATH=D:\\Path\\To\\Vault\\.obsidian\\plugins\\project-weave
PROJECT_WEAVE_RELEASE_VERSION=PASTE_EXACT_PRERELEASE_TAG_HERE
```

Then run `npm run plugin:update`. The destination must be the exact
`.obsidian/plugins/project-weave` folder, not a vault or general plugins folder.
The updater downloads the pinned release's three plugin assets to staging,
validates the manifest ID/version and bundle, backs up managed installed files,
then replaces them while preserving `data.json`. A download or validation
failure leaves the installed plugin untouched. Private-repository testing also
requires `GITHUB_TOKEN` in the process environment; public releases do not.
Reload Obsidian afterward.

## Dogfood vault

[ADR 0016](../Decisions/0016-dogfood-vault-location.md) tracks Project
Weave's own outstanding work in `docs/project-vault/`, a vault committed to
this repository. Unlike the disposable test vault, its content is not seeded
or reset — only the plugin's runtime files are installed into it.

### Configure once

Open `docs/project-vault/` as a vault in Obsidian and enable community
plugins (**Settings → Community plugins → Turn on community plugins**). This
creates the vault's `.obsidian/` directory, which is Git-ignored — see ADR
0016 for why. Nothing else needs configuring; the install path is fixed at
`docs/project-vault/`, not resolved from an environment variable or pointer
file.

### Update from the current branch

```shell
npm run project-vault:install
```

This builds the production bundle and copies the three plugin runtime files to:

```text
docs/project-vault/.obsidian/plugins/project-weave/
```

It fails with guidance if `docs/project-vault/.obsidian/` does not exist yet.
It creates the plugin directory when needed and preserves `data.json` and
other local plugin state, the same as `npm run test-vault:update`. It does
not run the automated gate or touch vault content — reload Obsidian or
disable and re-enable Project Weave to pick up a new build.

## BRAT preview channel

Obsidian has no official beta channel and recommends BRAT for beta testing.
Current BRAT versions install from GitHub release assets, not raw branch
contents. Do not add the legacy `manifest-beta.json` mechanism.

- [Obsidian beta-testing guidance](https://docs.obsidian.md/Plugins/Releasing/Beta-testing%20plugins)
- [BRAT developer guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)

### Preview publication action

The manually dispatched **Publish BRAT prerelease** GitHub Actions workflow
requires:

- `ref`: branch, tag, or commit SHA to build;
- `target_version`: intended stable version, for example `0.4.0`.

The action must:

1. Check out and record the exact commit.
2. Run `npm ci`, the complete gate, and the ordinary export.
3. Derive a unique beta version from the workflow run ID.
4. Stamp that version only into the generated release manifest. Do not change
   the tracked stable version files on the tested branch.
5. Require the release tag, release name, and released manifest version to
   match.
6. Create a GitHub prerelease containing the three individual plugin assets,
   plus the separately checksummed optional companion.
7. Record the source ref, SHA, validation result, compatibility, companion
   checksum, preview limitations, and test focus in its notes.

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
