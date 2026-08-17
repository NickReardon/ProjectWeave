# Contributing to Project Weave

Project Weave is an Obsidian community plugin whose canonical behavior is
documented in `docs/spec/`. Keep changes small, preserve unrelated work, and
update the owning specification when behavior changes.

## Before opening a pull request

1. Use a short-lived branch from `main`.
2. Run `npm ci` and `npm run check`.
3. Keep documentation and the behavior it describes in the same commit.
4. Report automated verification separately from manual Obsidian checks.

Pull requests should explain the user-visible behavior, compatibility impact,
and any manual checks that remain. Do not include vault data, local `.env`
files, API keys, grant secrets, or generated release output.

For security issues, follow [SECURITY.md](SECURITY.md) rather than opening a
public issue.
