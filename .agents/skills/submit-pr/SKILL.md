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

   - Fetch the centralized configuration file from the tracker repository (or fallback to local file) and parse the required variables:
     - **On macOS/Linux (Bash/Zsh)**:

       ````bash
       # Fetch config file from tracker repository (using main branch)
       CONFIG_MD=$(gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>/dev/null)

       # Fallback to local file if fetch failed
       if [ -z "$CONFIG_MD" ]; then
         if [ -f "docs/agents/project-config.md" ]; then
           CONFIG_MD=$(cat docs/agents/project-config.md)
         fi
       fi

       # Check if config content is present
       if [ -z "$CONFIG_MD" ]; then
         echo "ERROR: project-config.md not found or malformed — aborting to avoid null ID API calls" >&2
         exit 1
       fi

       # Extract and parse JSON
       CONFIG_JSON=$(echo "$CONFIG_MD" | sed -n '/^```json/,/^```$/p' | sed '1d;$d')
       ORG=$(echo "$CONFIG_JSON" | jq -r '.org')
       TRACKER_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.tracker')
       FRONTEND_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.frontend')
       PROJECT_NUMBER=$(echo "$CONFIG_JSON" | jq -r '.project.number')
       PROJECT_ID=$(echo "$CONFIG_JSON" | jq -r '.project.id')
       FIELD_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.id')
       BACKLOG_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.backlog')
       PR_REVIEW_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.pr_review')
       ````

     - **On Windows (PowerShell)**:

       ````powershell
       # Fetch config file from tracker repository (using main branch)
       $CONFIG_MD = (gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>$null)

       # Fallback to local file if fetch failed
       if (-not $CONFIG_MD -and (Test-Path "docs/agents/project-config.md")) {
         $CONFIG_MD = (Get-Content -Raw -Path "docs/agents/project-config.md")
       }

       # Check if config content is present
       if (-not $CONFIG_MD) {
         Write-Error "ERROR: project-config.md not found or malformed — aborting to avoid null ID API calls"
         exit 1
       }

       # Extract and parse JSON
       $CONFIG_JSON_STRING = [regex]::Match($CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value
       $CONFIG_JSON = ConvertFrom-Json $CONFIG_JSON_STRING
       $ORG = $CONFIG_JSON.org
       $TRACKER_REPO = $CONFIG_JSON.repos.tracker
       $FRONTEND_REPO = $CONFIG_JSON.repos.frontend
       $PROJECT_NUMBER = $CONFIG_JSON.project.number
       $PROJECT_ID = $CONFIG_JSON.project.id
       $FIELD_ID = $CONFIG_JSON.fields.status.id
       $BACKLOG_OPTION_ID = $CONFIG_JSON.fields.status.options.backlog
       $PR_REVIEW_OPTION_ID = $CONFIG_JSON.fields.status.options.pr_review
       ````

3. **Commit with High-lighted Changes & Push**
   - Write a conventional commit message.
   - **X-Tracker Ticket Link Requirement**: The commit message and PR description MUST link explicitly to the **X-Talent-Tracker** issue, **NOT** the X-Talent-Frontend issue.
     - Subject format: `feat: <description> (X-Tracker #<issue-number>)`
     - Reference link in body: `Ref: https://github.com/<ORG>/<TRACKER_REPO>/issues/<issue-number>` (using variables: `Ref: https://github.com/$ORG/$TRACKER_REPO/issues/$ISSUE_NUMBER`)
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
       if [ -n "$ITEM_ID" ]; then
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$PR_REVIEW_OPTION_ID" -f query='
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
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$PR_REVIEW_OPTION_ID" -f query='
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
