#!/usr/bin/env bash
# Core, tool-agnostic check: does the X-Talent-Tracker board status actually
# match the current branch's real state, instead of trusting that
# /start-ticket or /submit-pr remembered to run their board-update step?
#
# This script has no opinion about which AI CLI is calling it -- it is meant
# to be wrapped by a thin per-tool adapter (see .agents/scripts/hooks/) that
# translates its result into that tool's own hook output schema.
#
# Expected status is derived from ground truth, not from what commands ran:
#   - branch has an open PR   -> board should read "PR Review"
#   - branch has no open PR   -> board should read "In progress"
#   - branch has an issue num -> issue's Development section must have a linked branch or PR
#
# Only flags the two known regressions this was written for:
#   - expected "In progress" but board still reads "Backlog"
#   - expected "PR Review"   but board still reads "In progress"
# Any other actual status (Done, Blocked, a custom column, etc.) is left
# alone -- this is not the source of truth for the whole board, only a
# guard against these two known silent-skip failure modes. Every lookup
# failure (no issue number, config unavailable, no project item, etc.) is
# treated as OK -- this must never block unrelated work.
#
# Contract: prints nothing and exits 0 when there is nothing to report.
# Prints a human-readable (Traditional Chinese) explanation to stdout and
# exits 1 when the board is behind. Never exits with any other code.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 0

BRANCH_NAME=$(git branch --show-current 2>/dev/null)
ISSUE_NUMBER=$(echo "$BRANCH_NAME" | grep -oE '[0-9]+' | head -n 1)
[ -z "$ISSUE_NUMBER" ] && exit 0

source .agents/scripts/load-config.sh 2>/dev/null || exit 0
[ -z "${ORG:-}" ] && exit 0

OPEN_PR_COUNT=$(gh pr list --repo "$ORG/$FRONTEND_REPO" --head "$BRANCH_NAME" --state open --json number --jq 'length' 2>/dev/null)
[ $? -ne 0 ] && exit 0

if [ "${OPEN_PR_COUNT:-0}" -gt 0 ] 2>/dev/null; then
  EXPECTED_OPTION_ID="$PR_REVIEW_OPTION_ID"
  EXPECTED_LABEL="PR Review"
  WRONG_OPTION_ID="$IN_PROGRESS_OPTION_ID"
  WRONG_LABEL="In progress"
else
  EXPECTED_OPTION_ID="$IN_PROGRESS_OPTION_ID"
  EXPECTED_LABEL="In progress"
  WRONG_OPTION_ID="$BACKLOG_OPTION_ID"
  WRONG_LABEL="Backlog"
fi

# Same projectItems + Development link lookup against a given repo; only the
# repo name varies between the tracker-repo attempt and the frontend-repo
# fallback below.
get_issue_info() {
  local repo_name="$1"
  gh api graphql -F login="$ORG" -F issue_number="$ISSUE_NUMBER" -F repo_name="$repo_name" -f query='
    query($login: String!, $issue_number: Int!, $repo_name: String!) {
      organization(login: $login) {
        repository(name: $repo_name) {
          issue(number: $issue_number) {
            id
            linkedBranches(first: 5) { nodes { ref { name } } }
            closedByPullRequestsReferences(first: 5) { nodes { number } }
            projectItems(first: 5) { nodes { id project { number } } }
          }
        }
      }
    }
  ' 2>/dev/null
}

MATCHED_REPO="$TRACKER_REPO"
ISSUE_INFO=$(get_issue_info "$MATCHED_REPO")
HAS_ISSUE=$(echo "$ISSUE_INFO" | jq -r '.data.organization.repository.issue.id // empty' 2>/dev/null)
if [ -z "$HAS_ISSUE" ]; then
  MATCHED_REPO="$FRONTEND_REPO"
  ISSUE_INFO=$(get_issue_info "$MATCHED_REPO")
  HAS_ISSUE=$(echo "$ISSUE_INFO" | jq -r '.data.organization.repository.issue.id // empty' 2>/dev/null)
fi
[ -z "$HAS_ISSUE" ] && exit 0

# Ensure the branch/PR is actually linked in the issue's Development section.
LINK_COUNT=$(echo "$ISSUE_INFO" | jq -r '
  ((.data.organization.repository.issue.linkedBranches.nodes | length) +
   (.data.organization.repository.issue.closedByPullRequestsReferences.nodes | length))
' 2>/dev/null)

if [ "${LINK_COUNT:-0}" -eq 0 ] 2>/dev/null; then
  # Self-heal: attempt to link the branch automatically via link-ticket-branch.sh
  if [ -f "$REPO_ROOT/.agents/scripts/link-ticket-branch.sh" ]; then
    bash "$REPO_ROOT/.agents/scripts/link-ticket-branch.sh" "$ISSUE_NUMBER" "$BRANCH_NAME" --no-checkout --no-board-update >/dev/null 2>&1 || true
    ISSUE_INFO=$(get_issue_info "$MATCHED_REPO")
    LINK_COUNT=$(echo "$ISSUE_INFO" | jq -r '
      ((.data.organization.repository.issue.linkedBranches.nodes | length) +
       (.data.organization.repository.issue.closedByPullRequestsReferences.nodes | length))
    ' 2>/dev/null)
  fi
  if [ "${LINK_COUNT:-0}" -eq 0 ] 2>/dev/null; then
    cat <<EOF
X-Tracker #$ISSUE_NUMBER 的 Development 欄位尚未連結目前分支「$BRANCH_NAME」。請在結束前執行以下指令完成 Ticket 與 Branch 連結：

bash .agents/scripts/link-ticket-branch.sh "$ISSUE_NUMBER" "$BRANCH_NAME" --no-checkout
EOF
    exit 1
  fi
fi

ITEM_ID=$(echo "$ISSUE_INFO" | jq -r ".data.organization.repository.issue.projectItems.nodes[] | select(.project.number == $PROJECT_NUMBER) | .id" 2>/dev/null)
if [ -z "$ITEM_ID" ] && [ -n "${PROJECT_ID:-}" ] && [ -n "$HAS_ISSUE" ]; then
  ITEM_ID=$(gh api graphql -F project_id="$PROJECT_ID" -F content_id="$HAS_ISSUE" -f query='
    mutation($project_id: ID!, $content_id: ID!) {
      addProjectV2ItemById(input: { projectId: $project_id, contentId: $content_id }) { item { id } }
    }
  ' --jq '.data.addProjectV2ItemById.item.id' 2>/dev/null)
  sleep 3
fi
[ -z "$ITEM_ID" ] && exit 0

ACTUAL_STATUS_JSON=$(gh api graphql -F item_id="$ITEM_ID" -f query='
  query($item_id: ID!) {
    node(id: $item_id) {
      ... on ProjectV2Item {
        fieldValueByName(name: "Status") {
          ... on ProjectV2ItemFieldSingleSelectValue {
            optionId
            name
          }
        }
      }
    }
  }
' 2>/dev/null)

ACTUAL_OPTION_ID=$(echo "$ACTUAL_STATUS_JSON" | jq -r '.data.node.fieldValueByName.optionId // empty' 2>/dev/null)
ACTUAL_LABEL=$(echo "$ACTUAL_STATUS_JSON" | jq -r '.data.node.fieldValueByName.name // "未設定"' 2>/dev/null)

[ "$ACTUAL_OPTION_ID" = "$EXPECTED_OPTION_ID" ] && exit 0

# Leave terminal/post-PR columns (QA Review, Done, Blocked, Cancel) untouched.
case "$ACTUAL_LABEL" in
  "QA Review"|"Done"|"Blocked"|"Cancel")
    exit 0
    ;;
esac

if [ "${OPEN_PR_COUNT:-0}" -eq 0 ] 2>/dev/null && [ "$ACTUAL_LABEL" = "PR Review" ]; then
  exit 0
fi

# Self-heal: update the Project V2 board status directly first
gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$EXPECTED_OPTION_ID" -f query='
  mutation($project_id: ID!, $item_id: ID!, $field_id: ID!, $option_id: String!) {
    updateProjectV2ItemFieldValue(
      input: { projectId: $project_id, itemId: $item_id, fieldId: $field_id, value: { singleSelectOptionId: $option_id } }
    ) { projectV2Item { id } }
  }
' >/dev/null 2>&1 && exit 0

cat <<EOF
X-Tracker #$ISSUE_NUMBER 的看板狀態還停在「$ACTUAL_LABEL」，但目前分支狀態顯示應該是「$EXPECTED_LABEL」。請在結束前執行以下 mutation 把狀態改過來，再結束這個 turn：

gh api graphql -F project_id="$PROJECT_ID" -F item_id="$ITEM_ID" -F field_id="$FIELD_ID" -F option_id="$EXPECTED_OPTION_ID" -f query='
  mutation(\$project_id: ID!, \$item_id: ID!, \$field_id: ID!, \$option_id: String!) {
    updateProjectV2ItemFieldValue(
      input: { projectId: \$project_id, itemId: \$item_id, fieldId: \$field_id, value: { singleSelectOptionId: \$option_id } }
    ) { projectV2Item { id } }
  }
'
EOF
exit 1
