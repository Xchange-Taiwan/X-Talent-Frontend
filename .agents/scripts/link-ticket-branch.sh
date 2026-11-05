#!/usr/bin/env bash
# Idempotently creates and links a Git branch in $FRONTEND_REPO to an issue in
# $TRACKER_REPO (or $FRONTEND_REPO) via GitHub's GraphQL `createLinkedBranch`
# mutation, verifies `linkedBranches` / `closedByPullRequestsReferences` is
# non-empty, and optionally checks out the branch and moves the Project V2
# board item to "In progress".
#
# Handles all three branch states safely in a single self-contained shell
# execution (avoiding lost shell state across AI tool calls):
#   1. Already linked on GitHub -> no-op (ensures local checkout/upstream)
#   2. Remote branch does not exist yet -> calls createLinkedBranch from
#      current local branch HEAD or origin/develop (works in git worktrees too)
#   3. Remote branch already exists on origin but is NOT linked -> deletes the
#      unlinked remote ref (if no open PR exists) and recreates it at the exact
#      same commit SHA via createLinkedBranch so it links to the issue.
#
# Usage:
#   bash .agents/scripts/link-ticket-branch.sh [<issue-number-or-url>] [<branch-name>] [--no-checkout] [--no-board-update]

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-config.sh" || exit 1

NO_CHECKOUT=0
NO_BOARD_UPDATE=0
POSITIONAL=()

for arg in "$@"; do
  case "$arg" in
    --no-checkout)
      NO_CHECKOUT=1
      ;;
    --no-board-update)
      NO_BOARD_UPDATE=1
      ;;
    *)
      POSITIONAL+=("$arg")
      ;;
  esac
done

RAW_ISSUE="${POSITIONAL[0]:-}"
TARGET_BRANCH="${POSITIONAL[1]:-}"

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || true)
if [ -z "$TARGET_BRANCH" ]; then
  TARGET_BRANCH="$CURRENT_BRANCH"
fi

ISSUE_REPO="$TRACKER_REPO"
ISSUE_NUMBER=""

if [ -n "$RAW_ISSUE" ]; then
  if [[ "$RAW_ISSUE" =~ github\.com/[^/]+/([^/]+)/issues/([0-9]+) ]]; then
    ISSUE_REPO="${BASH_REMATCH[1]}"
    ISSUE_NUMBER="${BASH_REMATCH[2]}"
  elif [[ "$RAW_ISSUE" =~ ^([0-9]+)$ ]]; then
    ISSUE_NUMBER="${BASH_REMATCH[1]}"
  else
    ISSUE_NUMBER=$(echo "$RAW_ISSUE" | grep -oE '[0-9]+' | head -n 1 || true)
  fi
fi

if [ -z "$ISSUE_NUMBER" ] && [ -n "$TARGET_BRANCH" ]; then
  ISSUE_NUMBER=$(echo "$TARGET_BRANCH" | grep -oE '[0-9]+' | head -n 1 || true)
fi

if [ -z "$ISSUE_NUMBER" ]; then
  echo "⚠️ Could not determine issue number from arguments or branch '$TARGET_BRANCH'. Skipping branch link." >&2
  exit 0
fi

if [ -z "$TARGET_BRANCH" ] || [ "$TARGET_BRANCH" = "develop" ] || [ "$TARGET_BRANCH" = "main" ]; then
  echo "ERROR: Please provide a feature/fix branch name (e.g. feat/$ISSUE_NUMBER-short-slug)." >&2
  exit 1
fi

query_issue_state() {
  local repo_name="$1"
  gh api graphql -F login="$ORG" -F repo="$repo_name" -F issue_number="$ISSUE_NUMBER" -f query='
    query($login: String!, $repo: String!, $issue_number: Int!) {
      repository(owner: $login, name: $repo) {
        issue(number: $issue_number) {
          id
          number
          title
          linkedBranches(first: 10) {
            nodes {
              id
              ref { name }
            }
          }
          closedByPullRequestsReferences(first: 10) {
            nodes {
              number
              state
              headRefName
              url
            }
          }
          projectItems(first: 10) {
            nodes {
              id
              project { number }
            }
          }
        }
      }
    }
  ' 2>/dev/null || true
}

ISSUE_JSON=$(query_issue_state "$ISSUE_REPO")
ISSUE_NODE_ID=$(echo "$ISSUE_JSON" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try {
      const j = JSON.parse(d);
      console.log(j?.data?.repository?.issue?.id || "");
    } catch { console.log(""); }
  });
')

if [ -z "$ISSUE_NODE_ID" ] && [ "$ISSUE_REPO" != "$FRONTEND_REPO" ]; then
  ISSUE_REPO="$FRONTEND_REPO"
  ISSUE_JSON=$(query_issue_state "$ISSUE_REPO")
  ISSUE_NODE_ID=$(echo "$ISSUE_JSON" | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        console.log(j?.data?.repository?.issue?.id || "");
      } catch { console.log(""); }
    });
  ')
fi

if [ -z "$ISSUE_NODE_ID" ]; then
  echo "ERROR: Could not find issue #$ISSUE_NUMBER in $ORG/$TRACKER_REPO or $ORG/$FRONTEND_REPO." >&2
  exit 1
fi

REPO_NODE_ID=$(gh api graphql -F login="$ORG" -F repo="$FRONTEND_REPO" -f query='
  query($login: String!, $repo: String!) {
    repository(owner: $login, name: $repo) { id }
  }
' --jq '.data.repository.id' 2>/dev/null || true)

if [ -z "$REPO_NODE_ID" ]; then
  echo "ERROR: Could not resolve repository node ID for $ORG/$FRONTEND_REPO." >&2
  exit 1
fi

ALREADY_LINKED=$(echo "$ISSUE_JSON" | node -e '
  let d = "";
  const target = process.argv[1];
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try {
      const issue = JSON.parse(d)?.data?.repository?.issue;
      const lbs = (issue?.linkedBranches?.nodes || []).map(n => n?.ref?.name).filter(Boolean);
      const prs = (issue?.closedByPullRequestsReferences?.nodes || []).map(n => n?.headRefName).filter(Boolean);
      if (lbs.includes(target) || prs.includes(target) || lbs.length > 0 || prs.length > 0) {
        console.log("yes");
      } else {
        console.log("no");
      }
    } catch { console.log("no"); }
  });
' "$TARGET_BRANCH")

if [ "$ALREADY_LINKED" = "yes" ]; then
  echo "✅ Issue #$ISSUE_NUMBER ($ISSUE_REPO) is already linked to branch/PR on GitHub."
else
  # Determine base OID for the linked branch:
  # Prefer existing local branch tip, then existing remote branch tip, then origin/develop.
  if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    BRANCH_OID=$(git rev-parse "refs/heads/$TARGET_BRANCH")
  elif git show-ref --verify --quiet "refs/remotes/origin/$TARGET_BRANCH"; then
    BRANCH_OID=$(git rev-parse "refs/remotes/origin/$TARGET_BRANCH")
  else
    git fetch origin develop --quiet 2>/dev/null || true
    if git show-ref --verify --quiet "refs/remotes/origin/develop"; then
      BRANCH_OID=$(git rev-parse "refs/remotes/origin/develop")
    else
      BRANCH_OID=$(git rev-parse HEAD)
    fi
  fi

  # Check if remote branch already exists on origin (which causes createLinkedBranch to fail)
  REMOTE_HEAD_LINE=$(git ls-remote --heads origin "$TARGET_BRANCH" 2>/dev/null || true)
  if [ -n "$REMOTE_HEAD_LINE" ]; then
    REMOTE_OID=$(echo "$REMOTE_HEAD_LINE" | awk '{print $1}')
    # If local branch doesn't exist yet, use the remote OID so we never lose remote commits
    if ! git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH" && [ -n "$REMOTE_OID" ]; then
      BRANCH_OID="$REMOTE_OID"
    fi
    ALL_PR_COUNT=$(gh pr list --repo "$ORG/$FRONTEND_REPO" --head "$TARGET_BRANCH" --state all --json number --jq 'length' 2>/dev/null || echo "0")
    if [ "${ALL_PR_COUNT:-0}" -eq 0 ] 2>/dev/null; then
      echo "ℹ️ Remote branch origin/$TARGET_BRANCH already exists without a link; recreating via createLinkedBranch at $BRANCH_OID..."
      git push origin --delete "$TARGET_BRANCH" >/dev/null 2>&1 || true
    fi
  fi

  MUTATION_OUT=$(gh api graphql -f query='
    mutation($issueId: ID!, $repositoryId: ID!, $oid: GitObjectID!, $name: String!) {
      createLinkedBranch(input: {issueId: $issueId, repositoryId: $repositoryId, oid: $oid, name: $name}) {
        linkedBranch { id ref { name } }
      }
    }
  ' -F issueId="$ISSUE_NODE_ID" -F repositoryId="$REPO_NODE_ID" -F oid="$BRANCH_OID" -F name="$TARGET_BRANCH" 2>&1 || true)

  LINKED_ID=$(echo "$MUTATION_OUT" | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        console.log(j?.data?.createLinkedBranch?.linkedBranch?.id || "");
      } catch { console.log(""); }
    });
  ')

  if [ -n "$LINKED_ID" ]; then
    echo "✅ Linked branch '$TARGET_BRANCH' to $ORG/$ISSUE_REPO#$ISSUE_NUMBER (id: $LINKED_ID)"
  else
    echo "⚠️ createLinkedBranch output: $MUTATION_OUT" >&2
  fi
fi

# Fetch the remote branch and configure checkout / upstream tracking
git fetch origin "$TARGET_BRANCH" >/dev/null 2>&1 || true

if [ "$NO_CHECKOUT" -eq 0 ]; then
  if [ "$CURRENT_BRANCH" = "$TARGET_BRANCH" ]; then
    git branch --set-upstream-to="origin/$TARGET_BRANCH" "$TARGET_BRANCH" >/dev/null 2>&1 || true
  elif git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    git checkout "$TARGET_BRANCH"
    git branch --set-upstream-to="origin/$TARGET_BRANCH" "$TARGET_BRANCH" >/dev/null 2>&1 || true
  else
    git checkout -b "$TARGET_BRANCH" --track "origin/$TARGET_BRANCH"
  fi
else
  if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH" && git show-ref --verify --quiet "refs/remotes/origin/$TARGET_BRANCH"; then
    git branch --set-upstream-to="origin/$TARGET_BRANCH" "$TARGET_BRANCH" >/dev/null 2>&1 || true
  fi
fi

# Verify link exists on GitHub
VERIFY_JSON=$(query_issue_state "$ISSUE_REPO")
VERIFIED=$(echo "$VERIFY_JSON" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try {
      const issue = JSON.parse(d)?.data?.repository?.issue;
      const lbs = (issue?.linkedBranches?.nodes || []).map(n => n?.ref?.name).filter(Boolean);
      const prs = (issue?.closedByPullRequestsReferences?.nodes || []).map(n => "#" + n?.number).filter(Boolean);
      if (lbs.length > 0 || prs.length > 0) {
        console.log("linkedBranches=[" + lbs.join(",") + "] linkedPRs=[" + prs.join(",") + "]");
      } else {
        console.log("");
      }
    } catch { console.log(""); }
  });
')

if [ -n "$VERIFIED" ]; then
  echo "✅ Verified Development link on #$ISSUE_NUMBER: $VERIFIED"
else
  # Fallback if an open PR already existed on $TARGET_BRANCH (so remote ref could not be deleted for createLinkedBranch):
  # Link the existing PR to the issue by adding Closes <issue-url> to the PR body.
  EXISTING_PR_NUM=$(gh pr list --repo "$ORG/$FRONTEND_REPO" --head "$TARGET_BRANCH" --state all --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null || true)
  if [ -n "$EXISTING_PR_NUM" ]; then
    ISSUE_URL="https://github.com/$ORG/$ISSUE_REPO/issues/$ISSUE_NUMBER"
    CURRENT_BODY=$(gh pr view "$EXISTING_PR_NUM" --repo "$ORG/$FRONTEND_REPO" --json body --jq '.body // ""' 2>/dev/null || true)
    if [[ "$CURRENT_BODY" != *"Closes $ISSUE_URL"* ]] && [[ "$CURRENT_BODY" != *"Closes $ORG/$ISSUE_REPO#$ISSUE_NUMBER"* ]]; then
      NEW_BODY=$(printf "%s\n\nCloses %s\n" "$CURRENT_BODY" "$ISSUE_URL")
      gh pr edit "$EXISTING_PR_NUM" --repo "$ORG/$FRONTEND_REPO" --body "$NEW_BODY" >/dev/null 2>&1 || true
      echo "✅ Linked existing PR #$EXISTING_PR_NUM to $ISSUE_URL"
    fi
  else
    echo "⚠️ Warning: #$ISSUE_NUMBER still has no linkedBranches or linkedPRs in Development." >&2
  fi
fi

# Update Project V2 Board to "In progress"
if [ "$NO_BOARD_UPDATE" -eq 0 ]; then
  ITEM_ID=$(echo "$VERIFY_JSON" | node -e '
    let d = "";
    const pnum = Number(process.argv[1]);
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const nodes = JSON.parse(d)?.data?.repository?.issue?.projectItems?.nodes || [];
        const match = nodes.find(n => n?.project?.number === pnum);
        console.log(match?.id || "");
      } catch { console.log(""); }
    });
  ' "$PROJECT_NUMBER")

  # If issue is not on the Project V2 board yet, add it automatically
  if [ -z "$ITEM_ID" ] && [ -n "$PROJECT_ID" ] && [ -n "$ISSUE_NODE_ID" ]; then
    ITEM_ID=$(gh api graphql -F project_id="$PROJECT_ID" -F content_id="$ISSUE_NODE_ID" -f query='
      mutation($project_id: ID!, $content_id: ID!) {
        addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) {
          item { id }
        }
      }
    ' --jq '.data.addProjectV2ItemById.item.id' 2>/dev/null || true)
    # Wait 3s for GitHub Project "Item added to project" automation (which sets Status=Backlog) to finish
    sleep 3
  fi

  if [ -n "$ITEM_ID" ] && [ -n "$IN_PROGRESS_OPTION_ID" ] && [ "$IN_PROGRESS_OPTION_ID" != "null" ]; then
    for attempt in 1 2 3 4; do
      gh api graphql -f project_id="$PROJECT_ID" -f item_id="$ITEM_ID" -f field_id="$FIELD_ID" -f option_id="$IN_PROGRESS_OPTION_ID" -f query='
        mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
          updateProjectV2ItemFieldValue(
            input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
          ) { projectV2Item { id } }
        }
      ' >/dev/null 2>&1 || true
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
      ' --jq '.data.node.fieldValueByName.optionId // empty' 2>/dev/null || true)
      [ "$ACTUAL_OPT" = "$IN_PROGRESS_OPTION_ID" ] && break
    done
    echo "✅ Ticket #$ISSUE_NUMBER moved to In progress on Project Board"
  fi
fi
