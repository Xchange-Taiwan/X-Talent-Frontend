# Board-status verification hooks

`.agents/scripts/tracker-ops.mjs` (`verify-board-status`) checks whether the
X-Talent-Tracker board status and GitHub `Development` branch/PR link match the
current branch's real state, automatically self-healing drift and enforcing
each AI CLI's hook schema (`--dialect=gemini` or `--dialect=claude`) when
healing fails.

## Gemini CLI

Wired automatically — `.gemini/settings.json` is checked into the repo and
invokes Node (`hooks/gemini-verify-board-status.mjs`, which delegates directly
to `tracker-ops.mjs` with `--dialect=gemini`) on the `AfterAgent` event.
Nothing to do.

## Claude Code

**Not wired automatically.** `.claude/` is gitignored in this repo (kept
local/per-developer; `.agents/` is the shared, cross-tool directory), so
there is no committed `.claude/settings.json` to carry this hook.

To enable it on your machine: copy the contents of
`claude-settings.example.json` into your own `.claude/settings.json`
(merge the `hooks.Stop` entry in if you already have other settings there).
