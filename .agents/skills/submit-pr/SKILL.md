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

   - Load the centralized configuration by sourcing the shared loading scripts:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       source .agents/scripts/load-config.sh
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       . .agents/scripts/load-config.ps1
       ```

3. **Commit with High-lighted Changes & Push**
   - Write a mature, professional conventional commit message.
   - **Commit Message Structure**:

     ```text
     <type>(<scope>): <subject> (X-Tracker #<issue-number>)

     <body>

     <footer>
     ```

     - **`<type>`**: Use `feat` (new feature), `fix` (bug fix), `docs` (documents), `refactor` (refactoring), `test` (tests), `chore` (maintenance), etc.
     - **`<scope>`**: Identify the modified module (e.g. `skills`, `profile`, `auth`, `reservation`, `ui`).
     - **`<subject>`**: Imperative mood, present tense, first letter lowercase, no trailing dot (e.g., `add config loading verification`).
     - **`(X-Tracker #<issue-number>)`**: Must append to the subject line.
     - **`<body>`**: High-signal explanation explaining the motivation, design decisions, and what changed. Do not just repeat the subject line.
     - **`<footer>`**: Explicitly link to the tracker issue. Format: `Ref: https://github.com/<ORG>/<TRACKER_REPO>/issues/<issue-number>` (using variables: `Ref: https://github.com/$ORG/$TRACKER_REPO/issues/$ISSUE_NUMBER`).

   - **X-Tracker Ticket Link Requirement**: The commit message and PR description MUST link explicitly to the **X-Talent-Tracker** issue, **NOT** the X-Talent-Frontend issue.
   - Clearly **high-light** modified files/modules using bold or code markdown blocks in the "What Does This PR Do?" section.
   - Push to origin.

4. **Create PR**
   - Create the PR: `gh pr create --fill --base develop`

5. **Move Ticket on Board to "PR Review"**
   - Fetch the Project Item ID in project board for the issue from `$TRACKER_REPO` (fallback to `$FRONTEND_REPO`):
     - **On macOS/Linux (Bash/Zsh)**:

       ```bash
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
       ```

     - **On Windows (PowerShell)**:

       ```powershell
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
       ```

   - Update Single Select status field (`FIELD_ID`) to "PR Review" (Option ID: `PR_REVIEW_OPTION_ID`):
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       if [ -n "$ITEM_ID" ] && [ -n "$PR_REVIEW_OPTION_ID" ] && [ "$PR_REVIEW_OPTION_ID" != "null" ]; then
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$PR_REVIEW_OPTION_ID" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         ' >/dev/null
       fi
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       if ($ITEM_ID -and $PR_REVIEW_OPTION_ID -and $PR_REVIEW_OPTION_ID -ne "null") {
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$PR_REVIEW_OPTION_ID" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         ' | Out-Null
       fi
       ```

6. **Output Summary**
   - Show the PR link and **high-light** all changes in Traditional Chinese (繁體中文).
