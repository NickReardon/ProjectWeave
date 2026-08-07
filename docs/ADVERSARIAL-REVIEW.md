# Project Weave — Adversarial Codebase Review

An actively-hostile read of the codebase at `D:\ProjectWeave` (HEAD `8dcfcb0`, clean tree,
version 0.4.1), focused on finding real bugs, robustness gaps, and defense-in-depth
weaknesses rather than a praise audit. See `docs/CURRENT_WORK.md` for the ordinary
handoff state; this file records only the adversarial findings.

## Verdict

No exploitable vulnerability (RCE, XSS, authorization break, or data-destroying write)
was found. The read-only indexing posture and the create-only write port hold against a
crafted vault and a crafted template. The issues below are real correctness/robustness
weaknesses, ordered by how much they would matter in an adversarial scenario.

## Findings

### Medium — fix before the write path gains more callers

**M1 — The "immutable" snapshot is only shallowly immutable.**
`IndexSnapshot` stores the entity `Map` by reference with no freezing
(`src/indexing/index-snapshot.ts:38-44`), and the builder only `Object.freeze`s the
`diagnostics` array while spreading the rest (`src/indexing/index-builder.ts:126-134`).
Critically, `entity.frontmatter` remains the live YAML-parsed object returned by
`readFrontmatterMapping` (`src/domain/markdown-parser.ts:170`). Nothing in the
application mutates it today, but the maintenance comment at `index-builder.ts:94-95`
claims these entities "are immutable", and that claim rests on convention, not
structure. The single sourced truth an agent/MCP slice would extend could corrupt every
view at once. A shallow `Object.freeze` of each entity at build time would make the
claim true.

**M2 — Full-projection re-render on every publication; large/churned vaults can thrash.**
Every `ProjectWeaveReadPublication`, however small, triggers a full `#render()` over the
entire view (`src/ui/project-workbench-view.ts:238-248`) and a full `refresh()` over all
markdown leaves for banners (`src/ui/note-diagnostic-banner.ts:48-67`). Result lists are
capped at 200, but `buildProjectWorkbenchModel` re-derives all tasks, diagnostics, and
sort, then slices. Vault events are coalesced to a 150 ms debounce
(`src/indexing/index-coordinator.ts:46`), so a flurry of edits or a syncing client can
force repeated churn. Focused re-render exists for the All Tasks results (`#refreshTasks`)
but headers, readiness, and other intercedent model state re-run the whole projection.

### Low

**L1 — `dependency_mode: advisory` is parsed and surfaced but never consulted.**
`deriveReadiness` (src/indexing/index-builder.ts:688-742) always blocks on an unfinished
same-project dependency; the mode is surfaced but inert (src/application/query-api.ts:84,
225). Design 16 (docs/design/16:115) says advisory mode must permit the transition with
acknowledgement. The edit slice isn't built, so this is latent — but the live Ready Now
path reports advisory-mode projects exactly as enforced-blocked, and the readiness flag
already encodes enforced semantics. Any later wiring of the advisory transition must
account for that. Not recorded as a loose end in CURRENT_WORK.

**L2 — `readControlled`'s `optional` flag is dead code.**
Both branches of the missing-value case return `null` regardless of `optional`
(src/domain/markdown-parser.ts:841-843). Cosmetic, but it reads as if an optional variant
exists; a future maintainer could "fix" that NULL branch and silently change required
scope behavior.

**L3 — The commit's change-detection gate rests on a weak fingerprint.**
The fingerprint is 32-bit FNV-1a of content + mtime + size
(src/adapters/obsidian/obsidian-vault-reader.ts:88-94), consumed as the sole gate at
src/application/note-creation-commit.ts:138. Against an honest race this is fine, but an
adversary controlling both note mtime and content (e.g., an aggressive sync client) can
brute-force a matching FNV + size in ~2^32 and slip a changed project or template past
the re-check. Cheap to upgrade to SHA-1 over content; it is the weakest point in the
write path.

### Low-confidence (flagged, not confirmed)

**Q1 — Case-sensitivity mismatch between scope and matching.** Scope comparison
(`isPathInProjectRoots`, src/settings/project-weave-settings.ts:132-144) is
case-sensitive; link/path matching elsewhere is case-insensitive (`sensitivity:'accent'`,
src/ports/vault-reader.ts:93). On a case-insensitive filesystem a path Obsidian reports
with different case than the configured root would be *refused*, not misdirected — safe
(fails closed) but a latent consistency trap.

**Q2 — Shipped-but-unreachable write-adjacent code.** `src/application/template-
catalog.ts`, `ObsidianVaultReader.setProjectRoots`, and two of the three task-search
modes have no runtime caller. Acknowledged in CURRENT_WORK, but dead branches near the
write path are where a future refactor tends to drop a guard.

## Attacks attempted and correctly deflected

- **Path traversal via task subfolder or title** — rejected by `resolveSubfolder`
  (src/application/task-creation-allocator.ts:206) for leading slashes, drive letters,
  control characters, and `..` post-normalization; the writer re-validates with
  `isSafeVaultNotePath` + scope (src/adapters/obsidian/obsidian-note-writer.ts:33-38).
- **ZIP slippage in the export tool** — `validateEntryName` rejects `/`, `\`, and `..`
  segments (scripts/zip.mjs:94-105).
- **YAML alias billion-laughs** — `maxAliasCount: 0` in `readFrontmatterMapping`
  (src/domain/markdown-parser.ts:89) makes anchors/merges throw → `invalid_value`
  diagnostic; the note is discarded, no crash.
- **XSS via note or template content** — all UI output uses `createEl { text }` /
  `textContent`; grep for `innerHTML`/`eval` returns nothing. The diagnostic banner is
  safe.
- **Overwrite / double-create race** — only `NoteWriter.createNote` exists; `Vault.create`
  is atomic-fail-on-existing; the commit re-checks target absence before writing.
- **Stack overflow from deeply nested YAML** — `toJS` is wrapped in `try/catch`
  (src/domain/markdown-parser.ts:88-89) → value discarded as a diagnostic, not a crash.

## Recommended fixes (in priority order)

1. Shallow-`Object.freeze` each entity at build time so the snapshot immutability claim
   is structural (M1).
2. Upgrade the fingerprint to a stronger hash over content (M2/L3 guard).
3. Consult `dependency_mode` in readiness, or document explicitly that Ready Now ignores
   advisory mode until the board slice (L1).
4. Note the re-render cost in CURRENT_WORK as a large-vault known limit, and consider
   scoping banner refresh to changed leaves (M2).
5. Delete or clamp the dead `optional` branch (L2).