---
name: implement
description: 'Implement a piece of work based on a spec or set of tickets.'
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

## X-Frontend Repositories Workflow

If the workspace is an `X-Frontend` project (e.g., `X-Talent-Frontend` or similar frontend repository), you MUST strictly follow this modular workflow:

1. **Setup Branch:**
   - Call the `/start-ticket <github-issue-url>` skill to automatically pull develop, create/link the branch programmatically via GraphQL, and analyze requirements.

2. **Implement Feature:**
   - Implement the requirements step-by-step. Use TDD where possible.
   - Run typechecking and tests regularly.
   - **Capture screenshot evidence for UI-facing changes (hard requirement, not best-effort):** CLAUDE.md requires visually verifying UI work before reporting it done, and `/submit-pr` Step 3 requires evidence to already exist for any UI-facing change. Do this **before** calling `/ai-review` in Step 3, not after — do not defer it to `/submit-pr`. With `pnpm dev` running locally, run:
     ```bash
     node scripts/capture-ui-evidence.mjs --routes <route1,route2,...> --role visitor|mentee|mentor [--viewport desktop|mobile]
     ```
     This drives a real Playwright browser against `http://localhost:3000`, logs in for real when `--role` isn't `visitor`, and saves numbered PNGs into `.agents/tmp/evidence/` (one call per role/viewport combination in scope — see below). Keep the printed file paths; `/submit-pr` Step 3 publishes them and embeds the resulting links in the PR body. Skip this entirely for changes with no visible UI surface (pure logic, config, tests) — do not run it "just in case."
     - **Do not proceed to Step 3 (`/ai-review`) if a UI-facing change was made but `.agents/tmp/evidence/` is still empty afterward.** Re-run the script (or fix whatever route/selector broke) before continuing.
     - **Role-specific surfaces** (header, navigation, profile, onboarding, or anything else CLAUDE.md's role-based UI rule applies to): call the script once per role actually reachable on the changed surface — visitor, mentee, mentor — instead of just one shot. The script signs in through the real sign-in UI using `DESIGN_AUDIT_MENTOR_EMAIL`/`DESIGN_AUDIT_MENTOR_PASSWORD` for mentor and `DESIGN_AUDIT_MENTEE_EMAIL`/`DESIGN_AUDIT_MENTEE_PASSWORD` for mentee (`.env.development.local`); these are separate from `E2E_EMAIL`/`E2E_PASSWORD` (the e2e suite's forged-session credentials, see `e2e/helpers/session.ts`) — never mix the two. Each invocation opens a fresh browser context, so there's no session to reset between roles. This always targets your own local `pnpm dev` server, never the deployed dev site (that's `/penpot-sync`'s job).
     - **Multi-viewport (RWD) coverage** is out of scope here — this step is single-viewport, quick PR evidence, not a design audit. When a change genuinely needs a full role × viewport sweep, run `/rwd-test` separately for that; don't fold its heavier output (composite images, HackMD upload, temporary code hacks) into this flow.

3. **Run AI Review Locally:**
   - Once implementation is complete, call the `/ai-review` skill to launch parallel sub-agents (Security, Correctness, Business Logic, Performance, Testing, Architecture, and Review Guide).
   - These agents will review your changes locally against the actual X-Tracker ticket requirements.
   - **Pass/Blocked criterion**: `/ai-review`'s summary stage returns `overallRisk.level` (`low` / `medium` / `high`), not a literal status line — derive the verdict yourself:
     - `overallRisk.level == "low"` → **PASS**.
     - `overallRisk.level == "medium"` or `"high"` → **BLOCKED**.
   - **Automated Handoff Contract**:
     - **If PASS**: You MUST automatically transition to **Step 4 (`/submit-pr`)** in the exact same turn without stopping, asking the user, or halting the workflow.
     - **If BLOCKED**: Directly address the findings yourself (critical issues, security warnings, logic bugs, anything driving the risk level), then re-run `/ai-review` and re-evaluate. Repeat this fix-and-re-review cycle up to a maximum of **20 attempts**. If it is still BLOCKED after 20 attempts, you MUST halt, output the accumulated findings clearly to the user, and wait for manual intervention. Do not proceed to `/submit-pr` until it passes.

4. **Complete & Submit PR:**
   - Once implementation is done, verified, and reviewed, call the `/submit-pr` skill to run final tests, commit, push, create a PR, and move the ticket to `PR Review` status.

5. **Post-PR Fix Loop:**
   - Unless the user has explicitly indicated they only want the PR opened and nothing further (e.g. "just open the PR", "stop once it's submitted"), automatically continue into the `/fix-pr` skill immediately after Step 4 succeeds — do not stop to ask first.
   - `/fix-pr` runs under its own existing rules unchanged (up to 20 rounds, Vercel daily-limit failures excluded from the retry budget and reported instead of retried). Do not alter or share its retry budget with Step 3's local `/ai-review` loop.
   - `/implement` is only considered fully complete when `/fix-pr` converges (all watched checks green) or its only remaining blocker is the Vercel daily deployment limit. Any other non-converged outcome (including hitting the 20-round cap) means `/implement` is **not** complete — report `/fix-pr`'s final findings to the user as-is and wait for manual intervention.
   - Never auto-merge the PR (`gh pr merge`) and never advance the X-Talent-Tracker board status past `PR Review` — both remain manual actions for the user, even when `/fix-pr` fully converges.

---

## General Guidelines (All Repositories)

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

Use the standard `gh` GitHub CLI for all GitHub operations / 請使用標準 `gh` CLI 進行所有 GitHub 相關操作（如建立/提交 PR）。
