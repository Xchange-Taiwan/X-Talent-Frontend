---
name: start-ticket
description: 'Prepare a git branch for a GitHub issue and link it programmatically (cross-repo) for proper tracking.'
disable-model-invocation: true
---

Prepare a branch for a GitHub issue, fetch details, and link it.

## Steps

0. **Fetch and Parse Configuration**
   Before executing the commands below, load the centralized configuration by sourcing the shared loading scripts:
   - **On macOS/Linux (Bash/Zsh)**:

     ```bash
     source .agents/scripts/load-config.sh || exit 1
     ```

   - **On Windows (PowerShell)**:
     ```powershell
     . .agents/scripts/load-config.ps1
     ```

1. **Switch to develop and pull latest**

   ```bash
   git checkout develop && git pull origin develop
   ```

2. **Fetch issue details**
   - **On macOS/Linux (Bash/Zsh)**:
     ```bash
     gh-axi issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
     ```
   - **On Windows (PowerShell)**:
     ```powershell
     gh-axi issue view <issue-number> --repo "$ORG/$TRACKER_REPO" --json number,title,body,comments
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
          ISSUE_NODE_ID=$(gh-axi api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number=<issue-number> -f query='
            query($login: String!, $repo: String!, $issue_number: Int!) {
              repository(owner: $login, name: $repo) {
                issue(number: $issue_number) { id }
              }
            }
          ' --jq '.data.repository.issue.id')

          REPO_NODE_ID=$(gh-axi api graphql -F login="$ORG" -F repo="$FRONTEND_REPO" -f query='
            query($login: String!, $repo: String!) {
              repository(owner: $login, name: $repo) { id }
            }
          ' --jq '.data.repository.id')
          ```

        - **On Windows (PowerShell)**:

          ```powershell
          $ISSUE_NODE_ID = (gh-axi api graphql -F login="$ORG" -F repo="$TRACKER_REPO" -F issue_number=<issue-number> -f query='
            query($login: String!, $repo: String!, $issue_number: Int!) {
              repository(owner: $login, name: $repo) {
                issue(number: $issue_number) { id }
              }
            }
          ' --jq '.data.repository.issue.id')

          $REPO_NODE_ID = (gh-axi api graphql -F login="$ORG" -F repo="$FRONTEND_REPO" -f query='
            query($login: String!, $repo: String!) {
              repository(owner: $login, name: $repo) { id }
            }
          ' --jq '.data.repository.id')
          ```

     3. Call mutation to create and link:
        - **On macOS/Linux (Bash/Zsh)**:
          ```bash
          gh-axi api graphql -f query='
            mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
              createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
                linkedBranch { id }
              }
            }' -F issueId="$ISSUE_NODE_ID" -F repositoryId="$REPO_NODE_ID" -F oid="$BRANCH_OID" -F name="feat/<issue-number>-<slug>"
          ```
        - **On Windows (PowerShell)**:
          ```powershell
          gh-axi api graphql -f query='
            mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
              createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
                linkedBranch { id }
              }
            }' -F issueId="$ISSUE_NODE_ID" -F repositoryId="$REPO_NODE_ID" -F oid="$BRANCH_OID" -F name="feat/<issue-number>-<slug>"
          ```
     4. Fetch and checkout locally:
        ```bash
        git fetch origin feat/<issue-number>-<slug>
        git checkout feat/<issue-number>-<slug>
        ```

   - **Same repo (e.g. ticket directly in X-Talent-Frontend)**:
     - **On macOS/Linux (Bash/Zsh)**:
       ```bash
       gh-axi issue develop <issue-number> --repo "$ORG/$FRONTEND_REPO" --name "feat/<issue-number>-<slug>" --base develop --checkout
       ```
     - **On Windows (PowerShell)**:
       ```powershell
       gh-axi issue develop <issue-number> --repo "$ORG/$FRONTEND_REPO" --name "feat/<issue-number>-<slug>" --base develop --checkout
       ```

4. **Move Ticket on Board to "In progress"**
   - Fetch the Project Item ID in project board for the issue from `$TRACKER_REPO` (fallback to `$FRONTEND_REPO`):
     - **On macOS/Linux (Bash/Zsh)**:

       ```bash
       ITEM_ID=$(gh-axi api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$TRACKER_REPO" -f query='
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
         ITEM_ID=$(gh-axi api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$FRONTEND_REPO" -f query='
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
       $ITEM_ID = (gh-axi api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$TRACKER_REPO" -f query='
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
         $ITEM_ID = (gh-axi api graphql -F login="$ORG" -F issue_number="<issue-number>" -F repo_name="$FRONTEND_REPO" -f query='
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
         gh-axi api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$IN_PROGRESS_OPTION_ID" -f query='
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
         gh-axi api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$IN_PROGRESS_OPTION_ID" -f query='
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
