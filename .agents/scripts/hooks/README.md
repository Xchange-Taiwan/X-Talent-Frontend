# Board-status verification hooks

`check-board-status.sh` (in the parent directory) checks whether the
X-Talent-Tracker board status actually matches the current branch's real
state, so `/start-ticket` and `/submit-pr` can't silently skip their
board-update step. The two files in this directory adapt its output to each
AI CLI's own hook schema.

## Gemini CLI

Wired automatically — `.gemini/settings.json` is checked into the repo and
already registers `gemini-verify-board-status.sh` on the `AfterAgent` event.
Nothing to do.

## Claude Code

**Not wired automatically.** `.claude/` is gitignored in this repo (kept
local/per-developer; `.agents/` is the shared, cross-tool directory), so
there is no committed `.claude/settings.json` to carry this hook.

To enable it on your machine: copy the contents of
`claude-settings.example.json` into your own `.claude/settings.json`
(merge the `hooks.Stop` entry in if you already have other settings there).
