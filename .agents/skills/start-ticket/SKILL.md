---
name: 'start-ticket'
description: '為 GitHub Issue 準備並綁定跨 Repo 開發分支（透過 GraphQL createLinkedBranch 連結 X-Talent-Tracker Ticket 與開發分支，支援一般目錄與 Git Worktree），驗證 Development 連結成功，並將 Project V2 看板狀態移至 In progress。'
---

Prepare a branch for a GitHub issue, fetch details, and link it.

> **⚠️ Execution note**: Shell state (exported variables, sourced functions) does **not** persist across separate command executions — only the working directory does. Previously, splitting Step 0 (`load-config`), Step 3 (`BRANCH_OID`, `ISSUE_NODE_ID`, `REPO_NODE_ID`, `createLinkedBranch`), and Step 4 (`ITEM_ID`, `updateProjectV2ItemFieldValue`) across separate tool calls caused `$ORG`, `$TRACKER_REPO`, `$ISSUE_NODE_ID`, and `$REPO_NODE_ID` to evaluate to empty strings (`""`), silently breaking branch linking and board status updates. Always use the self-contained `.agents/scripts/link-ticket-branch.sh` / `.agents/scripts/link-ticket-branch.ps1` script (or run the entire block in a single shell invocation).

## Steps

0. **Fetch and Parse Configuration & Issue Details**
   Run config loading and issue fetching in the **same** command execution:
   - **On macOS/Linux (Bash/Zsh)**:
     ```bash
     source .agents/scripts/load-config.sh || exit 1
     gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
     ```
   - **On Windows (PowerShell)**:
     ```powershell
     . .agents/scripts/load-config.ps1
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
     3. Use `.agents/scripts/link-ticket-branch.sh` (or `.ps1`), which runs in one self-contained shell execution, automatically handles pre-existing local/remote branches and worktrees (`--no-checkout` / `-NoCheckout`), checks that `linkedBranch.id` is non-null, verifies `linkedBranches` / `closedByPullRequestsReferences` on GitHub, auto-adds the issue to the Project V2 board if missing, and moves it to `In progress`:

   - **Recommended One-Step Script (Handles Cross-Repo Linking, Pre-existing Branches, Verification & Board Update)**:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       # Standard checkout:
       bash .agents/scripts/link-ticket-branch.sh <issue-number> "feat/<issue-number>-<slug>"

       # If using git worktree (create/link remote branch without switching current working tree):
       bash .agents/scripts/link-ticket-branch.sh <issue-number> "feat/<issue-number>-<slug>" --no-checkout
       git worktree add ../<worktree-dir> "feat/<issue-number>-<slug>"
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       # Standard checkout:
       & .agents/scripts/link-ticket-branch.ps1 <issue-number> "feat/<issue-number>-<slug>"

       # If using git worktree (create/link remote branch without switching current working tree):
       & .agents/scripts/link-ticket-branch.ps1 <issue-number> "feat/<issue-number>-<slug>" -NoCheckout
       git worktree add ../<worktree-dir> "feat/<issue-number>-<slug>"
       ```

   - **Equivalent Self-Contained Single-Block Fallback** (if running inline without the helper script, you MUST run this entire block in **one** shell call so variables stay in scope):
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       source .agents/scripts/load-config.sh || exit 1
       ISSUE_NUMBER=<issue-number>
       BRANCH_NAME="feat/<issue-number>-<slug>"

       git fetch origin develop --quiet 2>/dev/null || true
       if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
         BRANCH_OID=$(git rev-parse "refs/heads/$BRANCH_NAME")
       else
         BRANCH_OID=$(git rev-parse origin/develop)
       fi

       ISSUE_NODE_ID=$(gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number="$ISSUE_NUMBER" -f query='
         query($login: String!, $repo: String!, $issue_number: Int!) {
           repository(owner: $login, name: $repo) {
             issue(number: $issue_number) { id }
           }
         }
       ' --jq '.data.repository.issue.id')

       REPO_NODE_ID=$(gh api graphql -F login="$ORG" -F repo="$FRONTEND_REPO" -f query='
         query($login: String!, $repo: String!) {
           repository(owner: $login, name: $repo) { id }
         }
       ' --jq '.data.repository.id')

       # If remote branch already exists without a link and has no open PR, remove the unlinked ref first
       LINKED_COUNT=$(gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number="$ISSUE_NUMBER" -f query='
         query($login: String!, $repo: String!, $issue_number: Int!) {
           repository(owner: $login, name: $repo) {
             issue(number: $issue_number) {
               linkedBranches(first: 10) { nodes { ref { name } } }
             }
           }
         }
       ' --jq '.data.repository.issue.linkedBranches.nodes | length')

       if [ "${LINKED_COUNT:-0}" -eq 0 ]; then
         if [ -n "$(git ls-remote --heads origin "$BRANCH_NAME" 2>/dev/null)" ]; then
           git push origin --delete "$BRANCH_NAME" >/dev/null 2>&1 || true
         fi
         gh api graphql -f query='
           mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
             createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
               linkedBranch { id ref { name } }
             }
           }' -F issueId="$ISSUE_NODE_ID" -F repositoryId="$REPO_NODE_ID" -F oid="$BRANCH_OID" -F name="$BRANCH_NAME"
       fi

       git fetch origin "$BRANCH_NAME"
       git checkout "$BRANCH_NAME" 2>/dev/null || git checkout -b "$BRANCH_NAME" --track "origin/$BRANCH_NAME"
       git branch --set-upstream-to="origin/$BRANCH_NAME" "$BRANCH_NAME" >/dev/null 2>&1 || true

       # Verify linkedBranches is non-empty
       gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number="$ISSUE_NUMBER" -f query='
         query($login: String!, $repo: String!, $issue_number: Int!) {
           repository(owner: $login, name: $repo) {
             issue(number: $issue_number) {
               linkedBranches(first: 10) { nodes { ref { name } } }
             }
           }
         }
       ' --jq '.data.repository.issue.linkedBranches.nodes'

       # Move Ticket on Board to "In progress" (auto-adding to Project V2 if not yet on board)
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

       if [ -z "$ITEM_ID" ] && [ -n "$PROJECT_ID" ] && [ -n "$ISSUE_NODE_ID" ]; then
         ITEM_ID=$(gh api graphql -F project_id="$PROJECT_ID" -F content_id="$ISSUE_NODE_ID" -f query='
           mutation($project_id: ID!, $content_id: ID!) {
             addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) { item { id } }
           }
         ' --jq '.data.addProjectV2ItemById.item.id' 2>/dev/null)
       fi

       if [ -n "$ITEM_ID" ] && [ -n "$IN_PROGRESS_OPTION_ID" ] && [ "$IN_PROGRESS_OPTION_ID" != "null" ]; then
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$IN_PROGRESS_OPTION_ID" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         ' >/dev/null
         echo "✅ Ticket #$ISSUE_NUMBER linked to $BRANCH_NAME and moved to In progress"
       fi
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       . .agents/scripts/load-config.ps1
       $ISSUE_NUMBER = <issue-number>
       $BRANCH_NAME = "feat/<issue-number>-<slug>"
       & .agents/scripts/link-ticket-branch.ps1 $ISSUE_NUMBER $BRANCH_NAME
       ```

   - **Same repo (e.g. ticket directly in X-Talent-Frontend)**:
     - `link-ticket-branch.sh` / `link-ticket-branch.ps1` automatically falls back to `$FRONTEND_REPO` if you pass the full URL or if the issue is in `$FRONTEND_REPO`, or you can use:
       ```bash
       gh issue develop <issue-number> --repo "$ORG/$FRONTEND_REPO" --name "feat/<issue-number>-<slug>" --base develop --checkout
       ```

## Rules

- Always communicate in Traditional Chinese (繁體中文).
- Predict likely files to change using glob/grep searches. Do not implement any changes.
