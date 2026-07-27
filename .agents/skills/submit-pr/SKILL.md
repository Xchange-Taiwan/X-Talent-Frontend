---
name: submit-pr
description: 'Run quality checks, commit with highlighted changes, create a PR, and move the ticket to PR Review on the project board.'
disable-model-invocation: true
---

Submit changes for PR review, updating issue tracking status and highlighting modifications.

## Steps

1. **Verify Quality & Run Tests**
   - Run typescript check: `pnpm tsc` (or `pnpm run type-check`)
   - Run tests: `pnpm test` (or equivalent test runner)
   - Ensure everything passes. Do not proceed on failure.

2. **Stage files & Parse Branch**
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

3. **Commit with High-lighted Changes & Push**
   - Write a conventional commit message.
   - **X-Tracker Ticket Link Requirement**: The commit message and PR description MUST link explicitly to the **X-Talent-Tracker** issue, **NOT** the X-Talent-Frontend issue.
     - Subject format: `feat: <description> (X-Tracker #<issue-number>)`
     - Reference link in body: `Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/<issue-number>`
   - Clearly **high-light** modified files/modules using bold or code markdown blocks in the "What Does This PR Do?" section.
   - Push to origin.

4. **Create PR**
   - Create the PR: `gh pr create --fill --base develop`

5. **Move Ticket on Board to "PR Review"**
   - Fetch the Project Item ID in project 7 (`X-Talent`) for the issue from `X-Talent-Tracker` (fallback to `X-Talent-Frontend`):
     - **On macOS/Linux (Bash/Zsh)**:

       ```bash
       ITEM_ID=$(gh api graphql -F login="Xchange-Taiwan" -F issue_number="$ISSUE_NUMBER" -F repo_name="X-Talent-Tracker" -f query='
         query($login: String!, $issue_number: Int!, $repo_name: String!) {
           organization(login: $login) {
             repository(name: $repo_name) {
               issue(number: $issue_number) {
                 projectItems(first: 5) { nodes { id project { number } } }
               }
             }
           }
         }
       ' --jq '.data.organization.repository.issue.projectItems.nodes[] | select(.project.number == 7) | .id' 2>/dev/null)

       if [ -z "$ITEM_ID" ]; then
         ITEM_ID=$(gh api graphql -F login="Xchange-Taiwan" -F issue_number="$ISSUE_NUMBER" -F repo_name="X-Talent-Frontend" -f query='
           query($login: String!, $issue_number: Int!, $repo_name: String!) {
             organization(login: $login) {
               repository(name: $repo_name) {
                 issue(number: $issue_number) {
                   projectItems(first: 5) { nodes { id project { number } } }
                 }
               }
             }
           }
         ' --jq '.data.organization.repository.issue.projectItems.nodes[] | select(.project.number == 7) | .id' 2>/dev/null)
       fi
       ```

     - **On Windows (PowerShell)**:

       ```powershell
       $ITEM_ID = (gh api graphql -F login="Xchange-Taiwan" -F issue_number="$ISSUE_NUMBER" -F repo_name="X-Talent-Tracker" -f query='
         query($login: String!, $issue_number: Int!, $repo_name: String!) {
           organization(login: $login) {
             repository(name: $repo_name) {
               issue(number: $issue_number) {
                 projectItems(first: 5) { nodes { id project { number } } }
               }
             }
           }
         }
       ' --jq '.data.organization.repository.issue.projectItems.nodes[] | select(.project.number == 7) | .id' 2>$null)

       if (-not $ITEM_ID) {
         $ITEM_ID = (gh api graphql -F login="Xchange-Taiwan" -F issue_number="$ISSUE_NUMBER" -F repo_name="X-Talent-Frontend" -f query='
           query($login: String!, $issue_number: Int!, $repo_name: String!) {
             organization(login: $login) {
               repository(name: $repo_name) {
                 issue(number: $issue_number) {
                   projectItems(first: 5) { nodes { id project { number } } }
                 }
               }
             }
           }
         ' --jq '.data.organization.repository.issue.projectItems.nodes[] | select(.project.number == 7) | .id' 2>$null)
       }
       ```

   - Update Single Select status field (`PVTSSF_lADOBFpxMc4BULhhzhBVb_Y`) to "PR Review" (Option ID: `013ebc9d`):
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       if [ -n "$ITEM_ID" ]; then
         gh api graphql -F project_id="PVT_kwDOBFpxMc4BULhh" -F item_id="$ITEM_ID" -F field_id="PVTSSF_lADOBFpxMc4BULhhzhBVb_Y" -F option_id="013ebc9d" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         '
       fi
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       if ($ITEM_ID) {
         gh api graphql -F project_id="PVT_kwDOBFpxMc4BULhh" -F item_id="$ITEM_ID" -F field_id="PVTSSF_lADOBFpxMc4BULhhzhBVb_Y" -F option_id="013ebc9d" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         '
       fi
       ```

6. **Output Summary**
   - Show the PR link and **high-light** all changes in Traditional Chinese (繁體中文).
