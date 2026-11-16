---
name: 'submit-pr'
description: '在完成實作與測試後，自動驗證或補齊 Ticket 與 Branch 的連結、發佈 UI 截圖證據至 pr-evidence 分支、撰寫 Conventional Commit 並推送、建立 Pull Request，且確保 GitHub Project V2 看板卡片穩定移至 PR Review。'
---

Submit changes for PR review, updating issue tracking status and highlighting modifications.

> **⚠️ Execution note**: Shell state (exported variables, sourced functions) does **not** persist across separate command executions — only the working directory does. Prefer invoking the unified cross-platform Node CLI (`node .agents/scripts/tracker-ops.mjs` and `node .agents/scripts/link-ticket-branch.mjs`) directly so config resolution, evidence publishing, branch linking, and Project V2 board updates execute atomically without relying on prior shell variables.

## Steps

1. **Verify Quality & Run Tests**
   - **Check Git Status**: Verify that your local git working tree is clean (no uncommitted changes). If there are any uncommitted changes, you MUST stage and commit them first before proceeding. Running `/submit-pr` without committing will push an incomplete or outdated state of your work.
   - **Run Typechecking**: Execute `pnpm type-check` (which is configured for `tsc --noEmit`).
   - **Run Tests**: Execute `pnpm test` (which runs `vitest run`).
   - **Halt on Failure**: If either typechecking or testing fails, you MUST immediately halt and display the complete error output to the user. Do not stage, commit, push, or create any PR under any circumstances if verification fails.

2. **Stage files, Parse Branch, & Fetch Configuration**
   - Stage modified and newly created files. Never stage `.env` or secrets.
   - Parse the current branch name to get the issue number and load centralized configuration:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       eval "$(node .agents/scripts/tracker-ops.mjs load-config --format=sh)" || exit 1
       BRANCH_NAME=$(git branch --show-current)
       ISSUE_NUMBER=$(echo "$BRANCH_NAME" | grep -oE '[0-9]+' | head -n 1)
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       Invoke-Expression ((& node .agents/scripts/tracker-ops.mjs load-config --format=ps1) -join "`n")
       $BRANCH_NAME = (git branch --show-current)
       $ISSUE_NUMBER = ([regex]::Match($BRANCH_NAME, '\d+').Value)
       ```
   - **Graceful Fallback for Non-Numbered Branches**: If no `$ISSUE_NUMBER` is resolved from the branch name (e.g. `$ISSUE_NUMBER` is empty or null), you must skip all references to issue numbers in the commit message structure, PR titles, and the board update process. Do not hallucinate or guess any issue number.

3. **Publish Screenshot Evidence (If Already Captured Locally; Otherwise Delegated to CI)**
   - **CI Pipeline Auto-Capture Default**: To save local agent tokens and avoid slow local `pnpm dev` / Playwright timeouts, UI screenshots are captured automatically by the GitHub Actions CI pipeline (`deploy-pr.yml`) against the deployed PR Preview URL.
   - If `.agents/tmp/evidence/*.png` already contains screenshots (e.g. captured at the user's explicit request), publish them in a single fresh commit tree to the `pr-evidence` branch via Node:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       node .agents/scripts/tracker-ops.mjs publish-evidence .agents/tmp/evidence/*.png
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       $Pngs = (Get-ChildItem -Path .agents/tmp/evidence/*.png).FullName
       if ($Pngs) { & node .agents/scripts/tracker-ops.mjs publish-evidence @Pngs }
       ```
   - If `.agents/tmp/evidence/` is empty or missing, **do NOT start `pnpm dev` locally** — simply proceed to Step 4 and write `N/A` (the CI pipeline will automatically capture and post the PR Preview screenshots).

4. **Commit with High-lighted Changes & Push**
   - Write a mature, professional conventional commit message.
   - **Commit Message Structure**:

     ```text
     <type>(<scope>): <subject> (X-Tracker #<issue-number>)

     <body>

     ## Screenshot

     <screenshot-section>

     <footer>
     ```

     - **`<type>`**: Use `feat` (new feature), `fix` (bug fix), `docs` (documents), `refactor` (refactoring), `test` (tests), `chore` (maintenance), etc.
     - **`<scope>`**: Identify the modified module (e.g. `skills`, `profile`, `auth`, `reservation`, `ui`).
     - **`<subject>`**: Imperative mood, present tense, first letter lowercase, no trailing dot (e.g., `add config loading verification`).
     - **`(X-Tracker #<issue-number>)`**: Must append to the subject line. **Fallback**: If no `$ISSUE_NUMBER` is resolved, omit the entire ` (X-Tracker #<issue-number>)` tag (e.g., use `<type>(<scope>): <subject>`).
     - **`<body>`**: High-signal explanation explaining the motivation, design decisions, and what changed. Do not just repeat the subject line.
     - **`<screenshot-section>`**: For each URL from Step 3, embed it as a markdown image with a short label: `![<label>](<url>)`. If Step 3 was skipped or produced no links, write `N/A`.
     - **`<footer>`**: Explicitly link to the tracker issue. Format: `Ref: https://github.com/<ORG>/<TRACKER_REPO>/issues/<issue-number>` (using variables: `Ref: https://github.com/$ORG/$TRACKER_REPO/issues/$ISSUE_NUMBER`). **Fallback**: If no `$ISSUE_NUMBER` is resolved, omit the footer / `Ref` line completely.

   - **X-Tracker Ticket Link Requirement**: The commit message and PR description MUST link explicitly to the **X-Talent-Tracker** issue, **NOT** the X-Talent-Frontend issue (unless no `$ISSUE_NUMBER` is resolved).
   - Clearly **high-light** modified files/modules using bold or code markdown blocks in the "What Does This PR Do?" section.
   - **Ensure Ticket-to-Branch Link Before Push (Self-Healing Gate)**:
     Because `Ref: https://github.com/...` in the commit footer is NOT a GitHub closing keyword, GitHub only populates the issue's `Development` section if the branch was linked via `createLinkedBranch`. Before pushing, always run `node .agents/scripts/link-ticket-branch.mjs` with `--no-checkout --no-board-update` so the branch is guaranteed to be linked on GitHub before the PR is opened:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       BRANCH_NAME=$(git branch --show-current)
       node .agents/scripts/link-ticket-branch.mjs "" "$BRANCH_NAME" --no-checkout --no-board-update
       git push -u origin "$BRANCH_NAME"
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       $BRANCH_NAME = (git branch --show-current)
       & node .agents/scripts/link-ticket-branch.mjs "" $BRANCH_NAME --no-checkout --no-board-update
       git push -u origin $BRANCH_NAME
       ```

5. **Create PR**
   - **Create the PR**: Run `gh pr create --fill --base develop`
   - **PR Already Exists Fallback**: If the command fails because a pull request already exists for the branch, treat this as a successful update and proceed gracefully. Do not halt or abort.

6. **Move Ticket on Board to "PR Review"**
   - Run the self-contained cross-platform board verifier & healer (`verify-board-status`), which automatically loads `project-config.md` (with remote `X-Talent-Tracker` + local fallback), detects the open PR on the current branch, adds the issue to Project V2 if missing, and moves its status to `PR Review`:
     ```bash
     node .agents/scripts/tracker-ops.mjs verify-board-status --dialect=none
     ```

7. **Output Summary**
   - Show the PR link and **high-light** all changes in Traditional Chinese (繁體中文).
