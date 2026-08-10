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
   - **Capture screenshot evidence for UI-facing changes:** while verifying the change in a browser against the dev server (CLAUDE.md requires this before reporting UI work done), take a screenshot of the changed UI with `chrome-devtools-axi screenshot <path>` for each meaningful state (e.g. before/after, both mentor and mentee views if role-specific). Save the files under a scratch directory (e.g. `.agents/tmp/evidence/`) and keep the list of paths — `/submit-pr` Step 3 publishes them and embeds the resulting links in the PR body. Skip this for changes with no visible UI surface (pure logic, config, tests).

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

Please use the `gh-axi` GitHub CLI wrapper (falling back to `gh` only if `gh-axi` is unavailable) / 請優先使用 `gh-axi` 進行所有 GitHub 相關操作（如建立/提交 PR），僅在 `gh-axi` 無法使用時退回 `gh`。
