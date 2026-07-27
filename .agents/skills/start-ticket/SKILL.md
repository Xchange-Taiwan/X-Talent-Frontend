---
name: start-ticket
description: 'Prepare a git branch for a GitHub issue and link it programmatically (cross-repo) for proper tracking.'
disable-model-invocation: true
---

Prepare a branch for a GitHub issue, fetch details, and link it.

## Steps

1. **Switch to develop and pull latest**

   ```bash
   git checkout develop && git pull origin develop
   ```

2. **Fetch issue details**

   ```bash
   gh issue view <issue-number> --repo <owner>/<repo> --json number,title,body,comments
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
        ```bash
        ISSUE_NODE_ID=$(gh api graphql -f query='query { repository(owner: "Xchange-Taiwan", name: "X-Talent-Tracker") { issue(number: <issue-number>) { id } } }' --jq '.data.repository.issue.id')
        REPO_NODE_ID=$(gh api graphql -f query='query { repository(owner: "Xchange-Taiwan", name: "X-Talent-Frontend") { id } }' --jq '.data.repository.id')
        ```
     3. Call mutation to create and link:
        ```bash
        gh api graphql -f query='mutation { createLinkedBranch(input: { issueId: "'"$ISSUE_NODE_ID"'", repositoryId: "'"$REPO_NODE_ID"'", oid: "'"$BRANCH_OID"'", name: "feat/<issue-number>-<slug>" }) { linkedBranch { id } } }'
        ```
     4. Fetch and checkout locally:
        ```bash
        git fetch origin feat/<issue-number>-<slug>
        git checkout feat/<issue-number>-<slug>
        ```
   - **Same repo (e.g. ticket directly in X-Talent-Frontend)**:
     ```bash
     gh issue develop <issue-number> --repo <owner>/<repo> --name "feat/<issue-number>-<slug>" --base develop --checkout
     ```

## Rules

- Always communicate in Traditional Chinese (繁體中文).
- Predict likely files to change using glob/grep searches. Do not implement any changes.
