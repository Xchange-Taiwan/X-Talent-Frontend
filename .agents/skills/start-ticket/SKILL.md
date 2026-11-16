---
name: 'start-ticket'
description: '為 GitHub Issue 準備並綁定跨 Repo 開發分支（透過 GraphQL createLinkedBranch 連結 X-Talent-Tracker Ticket 與開發分支，支援一般目錄與 Git Worktree），驗證 Development 連結成功，並將 Project V2 看板狀態移至 In progress。'
---

Prepare a branch for a GitHub issue, fetch details, and link it.

> **⚠️ Execution note**: Shell state (exported variables, sourced functions) does **not** persist across separate command executions — only the working directory does. Always use the self-contained cross-platform Node entrypoint `node .agents/scripts/link-ticket-branch.mjs` (backed by `.agents/scripts/tracker-ops.mjs`) so config loading, `createLinkedBranch`, `Development` verification, and Project V2 board updates run deterministically in a single Node invocation on macOS, Linux, and Windows.

## Steps

0. **Fetch and Parse Configuration & Issue Details**
   Run config loading and issue fetching in the **same** command execution:
   - **On macOS/Linux (Bash/Zsh)**:
     ```bash
     eval "$(node .agents/scripts/tracker-ops.mjs load-config --format=sh)" || exit 1
     gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
     ```
   - **On Windows (PowerShell)**:
     ```powershell
     Invoke-Expression ((& node .agents/scripts/tracker-ops.mjs load-config --format=ps1) -join "`n")
     gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
     ```

1. **Sync Latest `develop`**
   - **Standard working tree**:
     ```bash
     git checkout develop && git pull origin develop
     ```
   - **Git Worktree / Parallel agent working tree** (when `develop` is already checked out in the main repo or another worktree, `git checkout develop` will fail with `already used by worktree`):
     ```bash
     git fetch origin develop
     ```

2. **Create & Verify a Programmatically Linked Branch + Move Board to "In progress"**
   - Branch naming convention: `feat/<issue-number>-<slug>` or `fix/<issue-number>-<slug>`.
   - **Important `createLinkedBranch` rules**:
     1. GitHub's `createLinkedBranch` mutation creates the remote branch AND links it in one step — if `origin/<branch>` already exists on GitHub, `createLinkedBranch` returns HTTP 200 with `{"data":{"createLinkedBranch":{"linkedBranch":null}}}` (a silent no-op with exit code 0!) instead of linking the existing branch.
     2. Never create a branch solely with `git checkout -b` or `git worktree add -b` and skip `createLinkedBranch`.
     3. Use `node .agents/scripts/link-ticket-branch.mjs`, which runs cross-platform in one self-contained Node execution, automatically handles pre-existing local/remote branches and worktrees (`--no-checkout`), checks that `linkedBranch.id` is non-null, verifies `linkedBranches` / `closedByPullRequestsReferences` on GitHub, auto-adds the issue to the Project V2 board if missing, and moves it to `In progress`:

   - **Recommended Cross-Platform One-Step Command (macOS, Linux & Windows)**:

     ```bash
     # Standard checkout:
     node .agents/scripts/link-ticket-branch.mjs <issue-number> "feat/<issue-number>-<slug>"

     # If using git worktree (create/link remote branch without switching current working tree):
     node .agents/scripts/link-ticket-branch.mjs <issue-number> "feat/<issue-number>-<slug>" --no-checkout
     git worktree add ../<worktree-dir> "feat/<issue-number>-<slug>"
     ```

   - **Same repo (e.g. ticket directly in X-Talent-Frontend)**:
     - `node .agents/scripts/link-ticket-branch.mjs` automatically falls back to `$FRONTEND_REPO` if you pass the full URL or if the issue is in `$FRONTEND_REPO`, or you can use:
       ```bash
       gh issue develop <issue-number> --repo "$ORG/$FRONTEND_REPO" --name "feat/<issue-number>-<slug>" --base develop --checkout
       ```

## Rules

- Always communicate in Traditional Chinese (繁體中文).
- Predict likely files to change using glob/grep searches. Do not implement any changes.
