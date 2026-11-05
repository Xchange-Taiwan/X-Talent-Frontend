---
name: 'submit-pr'
description: '在完成實作與測試後，自動驗證或補齊 Ticket 與 Branch 的連結、發佈 UI 截圖證據至 pr-evidence 分支、撰寫 Conventional Commit 並推送、建立 Pull Request，且確保 GitHub Project V2 看板卡片穩定移至 PR Review。'
---

Submit changes for PR review, updating issue tracking status and highlighting modifications.

> **⚠️ Execution note**: Shell state (exported variables, sourced functions) does **not** persist across separate command executions — only the working directory does. Any step below that reads `$ORG`, `$TRACKER_REPO`, `$ISSUE_NUMBER`, `$PROJECT_ID`, `$FIELD_ID`, or `$PR_REVIEW_OPTION_ID` MUST re-derive them (re-source `load-config.sh`/`load-config.ps1` and re-parse the branch name) inside that **same** command execution rather than relying on a prior step's `source`. Step 6 below is written as a single self-contained block for exactly this reason — do not split it across multiple command executions.

## Steps

1. **Verify Quality & Run Tests**
   - **Check Git Status**: Verify that your local git working tree is clean (no uncommitted changes). If there are any uncommitted changes, you MUST stage and commit them first before proceeding. Running `/submit-pr` without committing will push an incomplete or outdated state of your work.
   - **Run Typechecking**: Execute `pnpm type-check` (which is configured for `tsc --noEmit`).
   - **Run Tests**: Execute `pnpm test` (which runs `vitest run`).
   - **Halt on Failure**: If either typechecking or testing fails, you MUST immediately halt and display the complete error output to the user. Do not stage, commit, push, or create any PR under any circumstances if verification fails.

2. **Stage files, Parse Branch, & Fetch Configuration**
   - Stage modified and newly created files. Never stage `.env` or secrets.
   - Parse the current branch name to get the issue number:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       BRANCH_NAME=$(git branch --show-current)
       ISSUE_NUMBER=$(echo "$BRANCH_NAME" | grep -oE '[0-9]+' | head -n 1)
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       $BRANCH_NAME = (git branch --show-current)
       $ISSUE_NUMBER = ([regex]::Match($BRANCH_NAME, '\d+').Value)
       ```
   - **Graceful Fallback for Non-Numbered Branches**: If no `$ISSUE_NUMBER` is resolved from the branch name (e.g. `$ISSUE_NUMBER` is empty or null), you must skip all references to issue numbers in the commit message structure, PR titles, and the board update process. Do not hallucinate or guess any issue number.

   - Load the centralized configuration by sourcing the shared loading scripts:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       source .agents/scripts/load-config.sh || exit 1
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       . .agents/scripts/load-config.ps1
       ```

3. **Publish Screenshot Evidence (If Already Captured Locally; Otherwise Delegated to CI)**
   - **CI Pipeline Auto-Capture Default**: To save local agent tokens and avoid slow local `pnpm dev` / Playwright timeouts, UI screenshots are captured automatically by the GitHub Actions CI pipeline (`deploy-pr.yml`) against the deployed PR Preview URL.
   - If `.agents/tmp/evidence/*.png` already contains screenshots (e.g. captured at the user's explicit request), publish them to the `pr-evidence` branch:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       bash .agents/scripts/publish-evidence.sh .agents/tmp/evidence/*.png
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       Get-ChildItem -Path .agents\tmp\evidence\*.png | ForEach-Object { & .agents/scripts/publish-evidence.ps1 $_.FullName }
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
     Because `Ref: https://github.com/...` in the commit footer is NOT a GitHub closing keyword, GitHub only populates the issue's `Development` section if the branch was linked via `createLinkedBranch`. Before pushing, always run `link-ticket-branch` with `--no-checkout --no-board-update` so that even if `/start-ticket` was skipped or the branch was created via `git checkout -b` / `git worktree`, the branch is guaranteed to be linked on GitHub before the PR is opened:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       BRANCH_NAME=$(git branch --show-current)
       bash .agents/scripts/link-ticket-branch.sh "" "$BRANCH_NAME" --no-checkout --no-board-update
       git push -u origin "$BRANCH_NAME"
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       $BRANCH_NAME = (git branch --show-current)
       & .agents/scripts/link-ticket-branch.ps1 "" $BRANCH_NAME -NoCheckout -NoBoardUpdate
       git push -u origin $BRANCH_NAME
       ```

5. **Create PR**
   - **Create the PR**: Run `gh pr create --fill --base develop`
   - **PR Already Exists Fallback**: If the command fails because a pull request already exists for the branch, treat this as a successful update and proceed gracefully. Do not halt or abort.

6. **Move Ticket on Board to "PR Review"**
   - **This entire step MUST run as a single command execution**, from config loading through the mutation. Do not rely on `$ISSUE_NUMBER` or config variables set in Step 2 — re-derive everything below in the same shell invocation, since shell state does not carry over between separate command executions (see the execution note above). This is the step that was silently no-op-ing before this fix: by the time this ran as its own command, the config/vars sourced back in Step 2 had already gone out of scope, so the item lookup silently returned empty and the `if` guard skipped the mutation without printing an error.
   - **On macOS/Linux (Bash/Zsh)** — run as one block:

     ```bash
     source .agents/scripts/load-config.sh || exit 1
     BRANCH_NAME=$(git branch --show-current)
     ISSUE_NUMBER=$(echo "$BRANCH_NAME" | grep -oE '[0-9]+' | head -n 1)

     if [ -z "$ISSUE_NUMBER" ]; then
       echo "⚠️ No issue number detected in branch name. Skipping Project Board update."
       exit 0
     fi

     ITEM_ID=$(gh api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$TRACKER_REPO" -f query='
       query($login: String!, $issue_number: Int!, $repo_name: String!) {
         organization(login: $login) {
           repository(name: $repo_name) {
             issue(number: $issue_number) {
               projectItems(first: 5) { nodes { id project { number } } }
             }
           }
         }
       }
     ' --jq ".data.organization.repository.issue.projectItems.nodes[] | select(.project.number == $PROJECT_NUMBER) | .id" 2>/dev/null)

     if [ -z "$ITEM_ID" ]; then
       ITEM_ID=$(gh api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$FRONTEND_REPO" -f query='
         query($login: String!, $issue_number: Int!, $repo_name: String!) {
           organization(login: $login) {
             repository(name: $repo_name) {
               issue(number: $issue_number) {
                 projectItems(first: 5) { nodes { id project { number } } }
               }
             }
           }
         }
       ' --jq ".data.organization.repository.issue.projectItems.nodes[] | select(.project.number == $PROJECT_NUMBER) | .id" 2>/dev/null)
     fi

     if [ -z "$ITEM_ID" ]; then
       ISSUE_NODE_ID=$(gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number="$ISSUE_NUMBER" -f query='
         query($login: String!, $repo: String!, $issue_number: Int!) {
           repository(owner: $login, name: $repo) { issue(number: $issue_number) { id } }
         }
       ' --jq '.data.repository.issue.id' 2>/dev/null)
       if [ -n "$PROJECT_ID" ] && [ -n "$ISSUE_NODE_ID" ]; then
         ITEM_ID=$(gh api graphql -F project_id="$PROJECT_ID" -F content_id="$ISSUE_NODE_ID" -f query='
           mutation($project_id: ID!, $content_id: ID!) {
             addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) { item { id } }
           }
         ' --jq '.data.addProjectV2ItemById.item.id' 2>/dev/null)
         # Wait 3s for GitHub Project "Item added to project" automation to finish before setting PR Review
         sleep 3
       fi
     fi

     if [ -z "$ITEM_ID" ]; then
       echo "⚠️ 找不到對應的 Project Board 卡片，PR 已建立但看板狀態需手動更新"
       exit 0
     fi

     if [ -n "$PR_REVIEW_OPTION_ID" ] && [ "$PR_REVIEW_OPTION_ID" != "null" ]; then
       for attempt in 1 2 3 4; do
         gh api graphql -f project_id="$PROJECT_ID" -f item_id="$ITEM_ID" -f field_id="$FIELD_ID" -f option_id="$PR_REVIEW_OPTION_ID" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         ' >/dev/null
         sleep 2
         ACTUAL_OPT=$(gh api graphql -F item_id="$ITEM_ID" -f query='
           query($item_id: ID!) {
             node(id: $item_id) {
               ... on ProjectV2Item {
                 fieldValueByName(name: "Status") {
                   ... on ProjectV2ItemFieldSingleSelectValue { optionId }
                 }
               }
             }
           }
         ' --jq '.data.node.fieldValueByName.optionId // empty' 2>/dev/null)
         [ "$ACTUAL_OPT" = "$PR_REVIEW_OPTION_ID" ] && break
       done
       echo "✅ Ticket #$ISSUE_NUMBER moved to PR Review"
     fi
     ```

   - **On Windows (PowerShell)** — run as one block:

     ```powershell
     . .agents/scripts/load-config.ps1
     $BRANCH_NAME = (git branch --show-current)
     $ISSUE_NUMBER = ([regex]::Match($BRANCH_NAME, '\d+').Value)

     if (-not $ISSUE_NUMBER) {
       Write-Host "⚠️ No issue number detected in branch name. Skipping Project Board update."
       return
     }

     $ITEM_ID = (gh api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$TRACKER_REPO" -f query='
       query($login: String!, $issue_number: Int!, $repo_name: String!) {
         organization(login: $login) {
           repository(name: $repo_name) {
             issue(number: $issue_number) {
               projectItems(first: 5) { nodes { id project { number } } }
             }
           }
         }
       }
     ' --jq ".data.organization.repository.issue.projectItems.nodes[] | select(.project.number == $PROJECT_NUMBER) | .id" 2>$null)

     if (-not $ITEM_ID) {
       $ITEM_ID = (gh api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$FRONTEND_REPO" -f query='
         query($login: String!, $issue_number: Int!, $repo_name: String!) {
           organization(login: $login) {
             repository(name: $repo_name) {
               issue(number: $issue_number) {
                 projectItems(first: 5) { nodes { id project { number } } }
               }
             }
           }
         }
       ' --jq ".data.organization.repository.issue.projectItems.nodes[] | select(.project.number == $PROJECT_NUMBER) | .id" 2>$null)
     }

     if (-not $ITEM_ID) {
       $ISSUE_NODE_ID = (gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number="$ISSUE_NUMBER" -f query='
         query($login: String!, $repo: String!, $issue_number: Int!) {
           repository(owner: $login, name: $repo) { issue(number: $issue_number) { id } }
         }
       ' --jq '.data.repository.issue.id' 2>$null)
       if ($PROJECT_ID -and $ISSUE_NODE_ID) {
         $ITEM_ID = (gh api graphql -F project_id="$PROJECT_ID" -F content_id="$ISSUE_NODE_ID" -f query='
           mutation($project_id: ID!, $content_id: ID!) {
             addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) { item { id } }
           }
         ' --jq '.data.addProjectV2ItemById.item.id' 2>$null)
         # Wait 3s for GitHub Project "Item added to project" automation to finish before setting PR Review
         Start-Sleep -Seconds 3
       }
     }

     if (-not $ITEM_ID) {
       Write-Host "⚠️ 找不到對應的 Project Board 卡片，PR 已建立但看板狀態需手動更新"
       return
     }

     if ($PR_REVIEW_OPTION_ID -and $PR_REVIEW_OPTION_ID -ne "null") {
       foreach ($attempt in 1..4) {
         gh api graphql -f project_id="$PROJECT_ID" -f item_id="$ITEM_ID" -f field_id="$FIELD_ID" -f option_id="$PR_REVIEW_OPTION_ID" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         ' | Out-Null
         Start-Sleep -Seconds 2
         $ACTUAL_OPT = (gh api graphql -F item_id="$ITEM_ID" -f query='
           query($item_id: ID!) {
             node(id: $item_id) {
               ... on ProjectV2Item {
                 fieldValueByName(name: "Status") {
                   ... on ProjectV2ItemFieldSingleSelectValue { optionId }
                 }
               }
             }
           }
         ' --jq '.data.node.fieldValueByName.optionId // empty' 2>$null)
         if ($ACTUAL_OPT -eq $PR_REVIEW_OPTION_ID) { break }
       }
       Write-Host "✅ Ticket #$ISSUE_NUMBER moved to PR Review"
     }
     ```

7. **Output Summary**
   - Show the PR link and **high-light** all changes in Traditional Chinese (繁體中文).
