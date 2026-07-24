# ai:dev — local AI dev automation

`pnpm ai:dev <ticket-number>` runs a local dev → review → fix loop against a
`X-Talent-Tracker` issue using Gemini, entirely on your machine. It never
commits anything you'd actually push and never opens a PR — it stops once the
diff passes review (or hits its iteration cap) and hands control back to you.

This tool is intentionally independent of Claude Code / `.claude/commands` —
anyone with Node, `gh`, and a Gemini API key can run it, regardless of which
AI coding tool (if any) they otherwise use.

## Prerequisites

1. `pnpm install` (pulls in `cross-spawn`, already declared as a devDependency)
2. [`gh` CLI](https://cli.github.com/) installed and authenticated: `gh auth login`
   - Also needs the `project` scope to link branches / add issues to the board:
     check with `gh auth status`, and if `project` isn't listed, run
     `gh auth refresh -s project,read:project`
3. `GEMINI_API_KEY` set in `.env` (or exported in your shell) — get one at
   <https://aistudio.google.com/apikey>. See `.env.example`.
4. Your `origin` remote must point at the canonical `X-Talent-Frontend` repo
   (not a fork) — the tool cross-checks this before touching branches.

## Usage

```bash
pnpm ai:dev 306          # ticket number
pnpm ai:dev "#306"       # also accepted
pnpm ai:dev "https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/306"
```

There are no other required arguments. The tool:

1. Fast-forwards your local `develop` to `origin/develop` (refuses to auto-merge
   if your local `develop` has diverged — sort that out yourself first)
2. Fetches the ticket's title/body/comments from `X-Talent-Tracker`
3. Reuses an already-linked branch if one exists for the ticket, otherwise
   creates and links a new one (`feat/<number>-<slug>`)
4. Runs the dev agent → forced lint/type-check → Gemini review loop (see below)
5. Prints a summary and the exact `git` command to take over from there

## What happens each iteration

1. The dev agent (Gemini, with file read/write/search/delete tools) works
   against the ticket until it calls `submitForReview`
2. The orchestrator stages everything, auto-fixes lint on the changed files,
   re-stages, and creates a local WIP commit (`wip: ai:dev iteration N`) —
   this is what lets diffing/reviewing work at all, and gives you a rollback
   point per round if something goes sideways
3. Type-check errors are compared against a baseline captured before the
   agent started, so pre-existing issues elsewhere in the repo never get
   blamed on the agent
4. If lint/type-check fails, those errors go back to the dev agent as the
   next round's task — the Gemini reviewer isn't even called
5. Otherwise, the cumulative diff (`baseRef...HEAD`) goes through the same
   review pipeline CI runs on every PR: a Planner, then 6 specialist
   reviewers (Security / Correctness / Business Logic / Performance /
   Testing / Architecture) in parallel, then a Summary judgment call that
   assigns an overall risk level. A `high` risk sends the findings back to
   the dev agent for another round; `medium`/`low` end the run successfully
   (their findings are still shown in the final report, just not treated as
   blocking)
6. A circuit breaker stops the run early (before the iteration cap) if two
   consecutive rounds produce the same findings or an identical diff — the
   agent isn't making progress

## When it stops

Either way, nothing is pushed and no real commit is made — you'll see WIP
commits on the branch and a printed reminder:

```
git reset --soft <baseRef>
# review the diff, then commit it yourself
```

If it hits the iteration cap with unresolved findings, the last diff and the
final findings are left exactly as-is for you to take over manually.

## v1 limitations (by design, not oversights)

- **No dependency changes.** `package.json` is blocked; if a ticket needs a
  new package, the agent will say so in its final summary instead of trying
- **No `renameFile`.** Combine `writeFile` (new path) + `deleteFile` (old
  path) yourself if the agent doesn't
- **No directory deletion.** `deleteFile` only removes single files
- **Full-file rewrites only** — there's no patch/diff-based edit tool yet, so
  files over ~2000 lines / 75KB are refused outright rather than risking a
  truncated rewrite. Planned for a v2 `editFile` tool
- **Don't hand-edit files while a run is in progress** — there's no file
  locking; concurrent edits can be silently overwritten by the next WIP commit
