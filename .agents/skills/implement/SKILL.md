---
name: 'implement'
description: '在 X-Talent / X-Frontend 等專案實作 GitHub Issue 或 Ticket 需求（含自動呼叫 /start-ticket 建立並綁定 Linked Branch、本地輕量開發或一鍵 pnpm cloud:promote 交棒雲端、雲端 Pre-PR 20 輪 AI Review 與 Playwright E2E 自動收斂迴圈、擷取 UI 證據截圖、/submit-pr 開立 PR 與更新看板至 PR Review、以及 /fix-pr 收斂 CI）。當使用者要求實作（implement）某張 Ticket 或 Issue 時使用。'
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

2. **Write Lightweight Unit Tests First (TDD), Implement Feature, & Sync Storybook (`.stories.tsx`):**
   - **Unit/Component Tests First (Vitest — Local Mode)**:
     - Before writing production code, translate the ticket's Acceptance Criteria into fast, lightweight unit or component tests (`.test.ts` / `.test.tsx` in `src/`, run via `pnpm test` / `vitest run`).
     - In local developer sessions, do **NOT** run heavy browser E2E (`playwright test`) unless the ticket itself explicitly requests new E2E specs; in Cloud VM sessions (`cloud-implement.yml`), Playwright E2E (`pnpm test:e2e:mock --workers=4` + changed specs) runs automatically in the Pre-PR convergence loop.
   - Implement the requirements step-by-step until your new and existing unit tests pass.
   - **Storybook Source Sync (Mandatory for `src/components/` Changes — Zero Vercel Quota Cost)**:
     - Whenever you create or modify a UI component under `src/components/**/*.tsx`, you **MUST** create or update its companion Storybook story file (`.stories.tsx` in the same directory) within the **same commit/PR** so all new props, states, and variants are covered in the GitHub repository's `.stories.tsx` files (used directly by Design Hub / Codex and Cloudflare Storybook static deployments).
     - Never trigger extra Vercel deployments for Storybook — committing `.stories.tsx` alongside the feature PR consumes **0 extra Vercel deployment quota**.
   - Run deterministic checks (`pnpm lint`, `pnpm type-check`, `pnpm test`).
   - **UI Screenshot Evidence (Interactive E2E `captureEvidence` in Cloud VMs)**:
     - Whenever modifying UI pages or components (`src/app/**` or `src/components/**`), call `await captureEvidence(page, '<feature-open-state>')` (from `e2e/helpers/evidence`) inside the ticket's Playwright E2E `.spec.ts` **right after clicking/opening the target UI state** (e.g., after opening the Notification Popover, switching to the Reviews Tab, or opening a Dialog, and asserting `expect(...).toBeVisible()`). Never rely on static unauthenticated `/` screenshots for interactive components!
     - `captureEvidence` is a zero-cost no-op during ordinary local runs unless `CAPTURE_EVIDENCE=1` is set; in Cloud VM sessions (`cloud-implement.yml`), Phase 2 sets `CAPTURE_EVIDENCE=1`, captures pure Light Mode settled screenshots into `.agents/tmp/evidence/*.png`, verifies them multimodally with Gemini, and Phase 3 (`cloud-submit-pr.sh`) publishes them to `pr-evidence`.
     - Do **NOT** waste local tokens or time starting `pnpm dev` locally unless the user explicitly asks for local screenshots before opening a PR.

3. **Pre-PR Verification (Dual-Track: Local Lightweight vs. Cloud 20-Round + E2E Convergence):**
   - **Track A — Local Session (Zero Sub-Agent Overhead)**:
     - **Never spawn 7 local sub-agents** for pre-PR review.
     - Perform **1 single-pass check** (`node scripts/ai-review/run-local.mjs` or in-context check), OR run `pnpm cloud:promote` to push the current branch and let the Cloud VM run the 20-round AI Review + Playwright E2E convergence loop and open the PR.
   - **Track B — Cloud VM Session (`cloud-implement.yml` / `pnpm cloud:converge`)**:
     - Runs `node scripts/cloud-converge-loop.mjs --ticket=<issue-number> --max-rounds=20 --run-e2e=true`, which loops up to **20 rounds** of `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm test:e2e:mock --workers=4` (plus any changed E2E specs), and 7-agent parallel `run-local.mjs` (`gemini-4-argon`), automatically fixing any findings or E2E failures before opening the PR.
   - **Automated Handoff Contract**:
     - Once pre-PR verification passes, **immediately transition to Step 4 (`/submit-pr`)** in the exact same turn without stopping or asking the user.

4. **Complete & Submit PR:**
   - Once implementation is done, verified, and reviewed, call the `/submit-pr` skill to verify/self-heal the ticket-to-branch link, run final tests, commit, push, create a PR, and move the ticket to `PR Review` status.

5. **Post-PR Fix Loop (Token-Efficient CI Watch):**
   - Unless the user has explicitly indicated they only want the PR opened and nothing further (e.g. "just open the PR", "stop once it's submitted"), automatically continue into the `/fix-pr` skill immediately after Step 4 succeeds — do not stop to ask first.
   - `/fix-pr` uses `.agents/scripts/wait-pr-checks.sh` / `.ps1` to wait quietly in the terminal (0 LLM tokens burned while waiting) until the CI pipeline and free Gemini `AI Review: Final Summary` finish, and runs at most **3 fix rounds** locally (or up to 20 pre-push convergence rounds when triggered via `cloud-fix-pr.yml`).
   - `/implement` is only considered fully complete when `/fix-pr` converges (all watched checks green and AI Review `Overall Risk: low`) or its only remaining blocker is the Vercel daily deployment limit.
   - Never auto-merge the PR (`gh pr merge`) and never advance the X-Talent-Tracker board status past `PR Review` — both remain manual actions for the user, even when `/fix-pr` fully converges.

---

## General Guidelines (All Repositories)

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

Use the standard `gh` GitHub CLI for all GitHub operations / 請使用標準 `gh` CLI 進行所有 GitHub 相關操作（如建立/提交 PR）。
