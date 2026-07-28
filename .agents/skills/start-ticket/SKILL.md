---
name: start-ticket
description: 'Prepare a git branch for a GitHub issue and link it programmatically (cross-repo) for proper tracking.'
disable-model-invocation: true
---

Prepare a branch for a GitHub issue, fetch details, and link it.

## Steps

0. **Fetch and Parse Configuration**
   Before executing the commands below, fetch the centralized configuration file from the tracker repository (or fallback to local file) and parse the required variables:
   - **On macOS/Linux (Bash/Zsh)**:

     ````bash
     # Fetch config file from tracker repository (using main branch)
     CONFIG_MD=$(gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>/dev/null)

     # Fallback to local file if fetch failed (checks exit status or empty variable)
     if [ $? -ne 0 ] || [ -z "$CONFIG_MD" ]; then
       if [ -f "docs/agents/project-config.md" ]; then
         CONFIG_MD=$(cat docs/agents/project-config.md)
       else
         CONFIG_MD=""
       fi
     fi

     # Check if config content is present
     if [ -z "$CONFIG_MD" ]; then
       echo "ERROR: project-config.md not found — aborting to avoid null ID API calls" >&2
       exit 1
     fi

     # Remove Windows carriage returns to prevent sed/parsing failures
     CONFIG_MD=$(echo "$CONFIG_MD" | tr -d '\r')

     # Extract JSON block
     CONFIG_JSON=$(echo "$CONFIG_MD" | sed -n '/^```json/,/^```$/p' | sed '1d;$d')

     # Validate extracted JSON content
     if [ -z "$CONFIG_JSON" ] || [ "$CONFIG_JSON" = "null" ]; then
       echo "ERROR: project-config.md is malformed or missing JSON block — aborting" >&2
       exit 1
     fi

     # Parse variables using jq
     ORG=$(echo "$CONFIG_JSON" | jq -r '.org')
     TRACKER_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.tracker')
     FRONTEND_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.frontend')
     PROJECT_NUMBER=$(echo "$CONFIG_JSON" | jq -r '.project.number')
     PROJECT_ID=$(echo "$CONFIG_JSON" | jq -r '.project.id')
     FIELD_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.id')
     BACKLOG_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.backlog')
     IN_PROGRESS_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.in_progress')
     PR_REVIEW_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.pr_review')
     ````

   - **On Windows (PowerShell)**:

     ````powershell
     # Fetch config file from tracker repository (using main branch)
     $CONFIG_MD = (gh api repos/Xchange-Taiwan/X-Talent-Tracker/contents/docs/agents/project-config.md?ref=main -H "Accept: application/vnd.github.raw" 2>$null)

     # Fallback to local file if fetch failed (checks exit status or empty variable)
     if ($LastExitCode -ne 0 -or -not $CONFIG_MD) {
       if (Test-Path "docs/agents/project-config.md") {
         $CONFIG_MD = (Get-Content -Raw -Path "docs/agents/project-config.md")
       } else {
         $CONFIG_MD = $null
       }
     }

     # Check if config content is present
     if (-not $CONFIG_MD) {
       Write-Error "ERROR: project-config.md not found — aborting to avoid null ID API calls"
       exit 1
     }

     # Extract and parse JSON
     $CONFIG_JSON_STRING = [regex]::Match($CONFIG_MD, '(?s)```json\s*(.*?)\s*```').Groups[1].Value

     # Validate extracted JSON content
     if ([string]::IsNullOrWhiteSpace($CONFIG_JSON_STRING) -or $CONFIG_JSON_STRING -eq "null") {
       Write-Error "ERROR: project-config.md is malformed or missing JSON block — aborting"
       exit 1
     }

     $CONFIG_JSON = ConvertFrom-Json $CONFIG_JSON_STRING
     $ORG = $CONFIG_JSON.org
     $TRACKER_REPO = $CONFIG_JSON.repos.tracker
     $FRONTEND_REPO = $CONFIG_JSON.repos.frontend
     $PROJECT_NUMBER = $CONFIG_JSON.project.number
     $PROJECT_ID = $CONFIG_JSON.project.id
     $FIELD_ID = $CONFIG_JSON.fields.status.id
     $BACKLOG_OPTION_ID = $CONFIG_JSON.fields.status.options.backlog
     $IN_PROGRESS_OPTION_ID = $CONFIG_JSON.fields.status.options.in_progress
     $PR_REVIEW_OPTION_ID = $CONFIG_JSON.fields.status.options.pr_review
     ````

1. **Switch to develop and pull latest**

   ```bash
   git checkout develop && git pull origin develop
   ```

2. **Fetch issue details**
   - **On macOS/Linux (Bash/Zsh)**:
     ```bash
     gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
     ```
   - **On Windows (PowerShell)**:
     ```powershell
     gh issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
     ```

3. **Create a Programmatically Linked Branch (Cross-Repo Connection)**
   - Branch naming convention: `feat/<issue-number>-<slug>` or `fix/<issue-number>-<slug>`.
   - **Cross-repo (issue in X-Talent-Tracker, code in X-Talent-Frontend)**:
     Use GitHub's GraphQL API (`createLinkedBranch` mutation) to create the branch in the frontend repo and link it to the tracker issue:
     1. Get current HEAD OID:
        ```bash
        BRANCH_OID=$(git rev-parse HEAD)
        ```
     2. Get Issue Node ID and Repository Node ID:
        - **On macOS/Linux (Bash/Zsh)**:

          ```bash
          ISSUE_NODE_ID=$(gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number=<issue-number> -f query='
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
          ```

        - **On Windows (PowerShell)**:

          ```powershell
          $ISSUE_NODE_ID = (gh api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number=<issue-number> -f query='
            query($login: String!, $repo: String!, $issue_number: Int!) {
              repository(owner: $login, name: $repo) {
                issue(number: $issue_number) { id }
              }
            }
          ' --jq '.data.repository.issue.id')

          $REPO_NODE_ID = (gh api graphql -F login="$ORG" -F repo="$FRONTEND_REPO" -f query='
            query($login: String!, $repo: String!) {
              repository(owner: $login, name: $repo) { id }
            }
          ' --jq '.data.repository.id')
          ```

     3. Call mutation to create and link:
        - **On macOS/Linux (Bash/Zsh)**:
          ```bash
          gh api graphql -f query='mutation { createLinkedBranch(input: { issueId: "'"$ISSUE_NODE_ID"'", repositoryId: "'"$REPO_NODE_ID"'", oid: "'"$BRANCH_OID"'", name: "feat/<issue-number>-<slug>" }) { linkedBranch { id } } }'
          ```
        - **On Windows (PowerShell)**:
          ```powershell
          gh api graphql -f query='mutation { createLinkedBranch(input: { issueId: "'"$ISSUE_NODE_ID"'", repositoryId: "'"$REPO_NODE_ID"'", oid: "'"$BRANCH_OID"'", name: "feat/<issue-number>-<slug>" }) { linkedBranch { id } } }'
          ```
     4. Fetch and checkout locally:
        ```bash
        git fetch origin feat/<issue-number>-<slug>
        git checkout feat/<issue-number>-<slug>
        ```

   - **Same repo (e.g. ticket directly in X-Talent-Frontend)**:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       gh issue develop <issue-number> --repo "$ORG/$FRONTEND_REPO" --name "feat/<issue-number>-<slug>" --base develop --checkout
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       gh issue develop <issue-number> --repo "$ORG/$FRONTEND_REPO" --name "feat/<issue-number>-<slug>" --base develop --checkout
       ```

4. **Move Ticket on Board to "In progress"**
   - Fetch the Project Item ID in project board for the issue from `$TRACKER_REPO` (fallback to `$FRONTEND_REPO`):
     - **On macOS/Linux (Bash/Zsh)**:

       ```bash
       ITEM_ID=$(gh api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$TRACKER_REPO" -f query='
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
         ITEM_ID=$(gh api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$FRONTEND_REPO" -f query='
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
       $ITEM_ID = (gh api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$TRACKER_REPO" -f query='
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
         $ITEM_ID = (gh api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$FRONTEND_REPO" -f query='
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

   - Update Single Select status field (`FIELD_ID`) to "In progress" (Option ID: `IN_PROGRESS_OPTION_ID`):
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       if [ -n "$ITEM_ID" ] && [ -n "$IN_PROGRESS_OPTION_ID" ] && [ "$IN_PROGRESS_OPTION_ID" != "null" ]; then
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$IN_PROGRESS_OPTION_ID" -f query='
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
       if ($ITEM_ID -and $IN_PROGRESS_OPTION_ID -and $IN_PROGRESS_OPTION_ID -ne "null") {
         gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$IN_PROGRESS_OPTION_ID" -f query='
           mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
             updateProjectV2ItemFieldValue(
               input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
             ) { projectV2Item { id } }
           }
         ' | Out-Null
       fi
       ```

## Rules

- Always communicate in Traditional Chinese (繁體中文).
- Predict likely files to change using glob/grep searches. Do not implement any changes.
