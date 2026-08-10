---
name: submit-pr
description: 'Run quality checks, commit with highlighted changes, create a PR, and move the ticket to PR Review on the project board.'
disable-model-invocation: true
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

3. **Publish Screenshot Evidence (UI-facing changes only)**
   - If `/implement` Step 2 captured screenshot files for this change, publish them to the shared evidence branch to get stable, embeddable links:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       bash .agents/scripts/publish-evidence.sh <file1> [<file2> ...]
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       & .agents/scripts/publish-evidence.ps1 <file1> [<file2> ...]
       ```
   - Each stdout line is one `https://raw.githubusercontent.com/...` URL, in the same order as the input files — one per screenshot. Keep these for Step 4's commit message.
   - The script pushes straight to a dedicated `pr-evidence` branch via git plumbing (`hash-object`/`read-tree`/`commit-tree`); it never touches your current branch, working tree, staged changes, or index, so it is safe to run at any point in this flow.
   - **Failure is non-blocking**: if the script errors (e.g. no push permission), do not halt the PR — skip embedding screenshots and leave the `## Screenshot` section as `N/A`.
   - If there is no UI-facing change or no screenshots were captured, skip this step entirely.

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
   - **Push with Upstream Tracking**: Push to origin setting the upstream tracking branch to avoid push failures on newly created local branches:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       git push -u origin "$BRANCH_NAME"
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       git push -u origin $BRANCH_NAME
       ```

5. **Create PR**
   - **Create the PR**: Run `gh-axi pr create --fill --base develop` (use `gh-axi` — the token-efficient AI-agent wrapper for GitHub CLI — not raw `gh`)
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

     ITEM_ID=$(gh-axi api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$TRACKER_REPO" -f query='
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
       ITEM_ID=$(gh-axi api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$FRONTEND_REPO" -f query='
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
       echo "⚠️ 找不到對應的 Project Board 卡片，PR 已建立但看板狀態需手動更新"
       exit 0
     fi

     if [ -n "$PR_REVIEW_OPTION_ID" ] && [ "$PR_REVIEW_OPTION_ID" != "null" ]; then
       gh-axi api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$PR_REVIEW_OPTION_ID" -f query='
         mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
           updateProjectV2ItemFieldValue(
             input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
           ) { projectV2Item { id } }
         }
       ' >/dev/null
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

     $ITEM_ID = (gh-axi api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$TRACKER_REPO" -f query='
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
       $ITEM_ID = (gh-axi api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$FRONTEND_REPO" -f query='
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
       Write-Host "⚠️ 找不到對應的 Project Board 卡片，PR 已建立但看板狀態需手動更新"
       return
     }

     if ($PR_REVIEW_OPTION_ID -and $PR_REVIEW_OPTION_ID -ne "null") {
       gh-axi api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$PR_REVIEW_OPTION_ID" -f query='
         mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
           updateProjectV2ItemFieldValue(
             input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
           ) { projectV2Item { id } }
         }
       ' | Out-Null
       Write-Host "✅ Ticket #$ISSUE_NUMBER moved to PR Review"
     }
     ```

7. **Output Summary**
   - Show the PR link and **high-light** all changes in Traditional Chinese (繁體中文).
