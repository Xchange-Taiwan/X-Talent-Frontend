---
name: 'implement'
description: '在 X-Talent / X-Frontend 等專案實作 GitHub Issue 或 Ticket 需求（含自動呼叫 /start-ticket 建立並綁定 Linked Branch、擷取 UI 證據截圖、本地 /ai-review、/submit-pr 開立 PR 與更新看板至 PR Review、以及 /fix-pr 收斂 CI）。當使用者要求實作（implement）某張 Ticket 或 Issue 時使用。'
---

Implement the work described by the user in the spec or tickets.

## X-Frontend Repositories Workflow

If the workspace is an `X-Frontend` project (e.g., `X-Talent-Frontend` or similar frontend repository), you MUST strictly follow this modular workflow:

1. **Setup & Link Branch (Hard Gate — Never Skip):**
   - Call the `/start-ticket <github-issue-url>` skill to automatically pull `develop`, create/link the branch programmatically via GraphQL (`createLinkedBranch`), move the Project V2 board status to `In progress`, and analyze requirements.
   - **Recommended one-step execution** (prevents lost shell variables across separate tool calls and handles pre-existing local/remote branches and worktrees idempotently):
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       bash .agents/scripts/link-ticket-branch.sh <issue-number-or-url> "<feat|fix>/<issue-number>-<slug>"
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       & .agents/scripts/link-ticket-branch.ps1 <issue-number-or-url> "<feat|fix>/<issue-number>-<slug>"
       ```
   - **Git Worktree / Pre-existing Branch Rule**:
     - Never create a branch solely with `git checkout -b` or `git worktree add -b` and skip `/start-ticket`! If you are working in a `git worktree` (or if `develop` is checked out in the main working tree, or a local/remote branch already exists), run `link-ticket-branch.sh` / `link-ticket-branch.ps1` with `--no-checkout` (or `-NoCheckout`) first so `createLinkedBranch` creates and links the remote branch on GitHub from `origin/develop`, then `git fetch origin <branch>` and attach your worktree (`git worktree add <path> <branch>`).
   - **Verification Gate**: Before proceeding to Step 2, verify that the command output confirms `✅ Verified Development link on #<issue-number>` (`linkedBranches` or `linkedPRs` is non-empty). Do not start implementation on an unlinked branch.

2. **Write Lightweight Unit Tests First (TDD) & Implement Feature:**
   - **Unit/Component Tests First (Vitest — NOT Browser E2E)**:
     - Before writing production code, translate the ticket's Acceptance Criteria into fast, lightweight unit or component tests (`.test.ts` / `.test.tsx` in `src/`, run via `pnpm test` / `vitest run`).
     - Do **NOT** write or run heavy browser E2E (`playwright test`) before or during normal feature coding unless the ticket itself explicitly requests new E2E specs.
   - Implement the requirements step-by-step until your new and existing unit tests pass.
   - Run deterministic local checks (`pnpm lint`, `pnpm type-check`, `pnpm test`).
   - **UI Screenshot Evidence (Delegated to CI Pipeline by Default)**:
     - Do **NOT** waste local tokens or time starting `pnpm dev` and debugging local Playwright screenshot scripts before opening the PR — the GitHub Actions CI pipeline (`deploy-pr.yml`) automatically captures and attaches UI screenshots from the deployed PR Preview.
     - Only run `node scripts/capture-ui-evidence.mjs` locally if the user explicitly asks for local screenshots before opening a PR.

3. **Fast Pre-PR Verification (Zero Sub-Agent Overhead):**
   - **Never spawn 7 local sub-agents** for pre-PR review (full 7-agent AI Review runs automatically on GitHub Actions CI using the free `gemini-4-argon` pipeline after the PR is opened).
   - Before calling `/submit-pr`, perform **1 single-pass in-context self-check** (or run `node scripts/ai-review/run-local.mjs`, which uses free Gemini if `GEMINI_API_KEY` is in `.env.development.local` and otherwise exits immediately):
     - Confirm every Acceptance Criterion from the ticket is implemented and covered by a unit test.
     - Confirm no PII/secrets are logged and error/empty states are handled.
     - Confirm `pnpm lint`, `pnpm type-check`, and `pnpm test` all pass with exit code 0.
   - **Automated Handoff Contract**:
     - Once the single-pass check and `pnpm lint && pnpm type-check && pnpm test` pass, **immediately transition to Step 4 (`/submit-pr`)** in the exact same turn without stopping or asking the user.

4. **Complete & Submit PR:**
   - Once implementation is done, verified, and reviewed, call the `/submit-pr` skill to verify/self-heal the ticket-to-branch link, run final tests, commit, push, create a PR, and move the ticket to `PR Review` status.

5. **Post-PR Fix Loop (Token-Efficient CI Watch):**
   - Unless the user has explicitly indicated they only want the PR opened and nothing further (e.g. "just open the PR", "stop once it's submitted"), automatically continue into the `/fix-pr` skill immediately after Step 4 succeeds — do not stop to ask first.
   - `/fix-pr` uses `.agents/scripts/wait-pr-checks.sh` / `.ps1` to wait quietly in the terminal (0 LLM tokens burned while waiting) until the CI pipeline and free Gemini `AI Review: Final Summary` finish, and runs at most **3 fix rounds** (without spawning local sub-agents).
   - `/implement` is only considered fully complete when `/fix-pr` converges (all watched checks green and AI Review `Overall Risk: low`) or its only remaining blocker is the Vercel daily deployment limit.
   - Never auto-merge the PR (`gh pr merge`) and never advance the X-Talent-Tracker board status past `PR Review` — both remain manual actions for the user, even when `/fix-pr` fully converges.

---

## General Guidelines (All Repositories)

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

Use the standard `gh` GitHub CLI for all GitHub operations / 請使用標準 `gh` CLI 進行所有 GitHub 相關操作（如建立/提交 PR）。
