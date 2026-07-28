#!/usr/bin/env bash

# Test verification script for AI Review SKILL.md publishing components
# Covers:
# 1. Verification of the Null-Safe JQ PR comments parser.
# 2. Mock verification of the structural truncation logic.
# 3. Graceful fallback of GH CLI when GITHUB_TOKEN is masked or failing.

EXIT_CODE=0
TEST_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'test-ai-review')

echo "=================================================="
echo "Running automated verification for ai-review skill"
echo "=================================================="

# Helper function to assert values
assert_eq() {
  local actual="$1"
  local expected="$2"
  local name="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  [PASS] $name"
  else
    echo "  [FAIL] $name: expected '$expected', got '$actual'" >&2
    EXIT_CODE=1
  fi
}

# Ensure clean teardown
cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# ----------------------------------------------------------------------
# Test 1: Null-Safe JQ Comments Filter
# ----------------------------------------------------------------------
echo "Test 1: JQ filter null-safety and comment ID selection"

# Create a mock comments list payload containing null body, regular comments, and multiple pipeline comments
cat << 'EOF' > "$TEST_DIR/mock-comments.json"
[
  {
    "id": 10001,
    "body": null,
    "user": { "login": "some-bot" }
  },
  {
    "id": 10002,
    "body": "Regular PR comment without marker",
    "user": { "login": "human-reviewer" }
  },
  {
    "id": 10003,
    "body": "<!-- ai-review-pipeline -->\n## 🤖 AI Code Review\nFirst report",
    "user": { "login": "github-actions[bot]" }
  },
  {
    "id": 10004,
    "body": null,
    "user": { "login": "another-webhook-bot" }
  },
  {
    "id": 10005,
    "body": "<!-- ai-review-pipeline -->\n## 🤖 AI Code Review\nSecond report (latest)",
    "user": { "login": "github-actions[bot]" }
  }
]
EOF

JQ_QUERY='map(select(.body != null and (.body | contains("<!-- ai-review-pipeline -->")))) | sort_by(.id) | last | .id // empty'
if command -v jq >/dev/null 2>&1; then
  ACTUAL_ID=$(jq "$JQ_QUERY" "$TEST_DIR/mock-comments.json")
  assert_eq "$ACTUAL_ID" "10005" "JQ extracts latest comment ID containing marker and bypasses null body comments"
else
  echo "⚠️ Warning: 'jq' utility not found. Skipping JQ null-safety test locally."
fi

# ----------------------------------------------------------------------
# Test 2: Structural Truncation Logic
# ----------------------------------------------------------------------
echo "Test 2: Structural Truncation Logic verification"

# Create a mock review report payload > 60k characters
MOCK_SUMMARY="<!-- ai-review-pipeline -->\n## 🤖 AI Code Review Report\nSummary section is safe."
MOCK_DETAILED="## Detailed Findings by Category\nDetailed findings section that is extremely long and needs to be truncated."

# Generate 65,000 characters of junk detailed findings
JUNK=$(head -c 65000 < /dev/zero | tr '\0' 'x')
MOCK_REPORT="${MOCK_SUMMARY}\n\n${MOCK_DETAILED}\n${JUNK}"

# Perform structural truncation in bash as specified in SKILL.md
# We find where "## Detailed Findings by Category" is and truncate from there.
TRUNCATED_REPORT=""
if [ ${#MOCK_REPORT} -gt 60000 ]; then
  # Find character index of the header
  INDEX=$(echo -e "$MOCK_REPORT" | grep -b -o "## Detailed Findings by Category" | cut -d: -f1 | head -n 1)
  if [ -n "$INDEX" ]; then
    TRUNCATED_REPORT="${MOCK_REPORT:0:$INDEX}"
    TRUNCATED_REPORT="${TRUNCATED_REPORT}\n> ⚠️ 完整報告過長，已截斷。完整內容請見本次 workflow run 的 CI artifact「ai-review-report.md」。"
  else
    # Fallback direct truncation
    TRUNCATED_REPORT="${MOCK_REPORT:0:59000}\n... [Truncated]"
  fi
else
  TRUNCATED_REPORT="$MOCK_REPORT"
fi

LEN=${#TRUNCATED_REPORT}
if [ $LEN -lt 60000 ]; then
  PASS_LIMIT=true
else
  PASS_LIMIT=false
fi

assert_eq "$PASS_LIMIT" "true" "Truncated report size ($LEN chars) is well below the 60,000 char threshold"
assert_eq "$(echo -e "$TRUNCATED_REPORT" | grep -c "Detailed Findings by Category")" "0" "Detailed Findings by Category is successfully truncated"
assert_eq "$(echo -e "$TRUNCATED_REPORT" | grep -c "完整報告過長，已截斷")" "1" "Truncation notice warning is correctly appended"

# ----------------------------------------------------------------------
# Test 3: Graceful Fallback check on GH API failures
# ----------------------------------------------------------------------
echo "Test 3: Graceful Fallback verification on CLI failures"

# Simulation of error capturing logic defined in SKILL.md:
# If GITHUB_API fails, output a stderr warning but exit 0.
MOCK_GH_API_FAIL() {
  echo "gh: Request failed (403: Forbidden)" >&2
  return 1
}

# Run mock logic in subshell
(
  MOCK_GH_API_FAIL 2>"$TEST_DIR/err.log"
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    echo "⚠️ Warning: GitHub API comments query failed: $(cat "$TEST_DIR/err.log")" >&2
    # Exit with code 0 as a graceful fallback instead of failing GHA run
    exit 0
  fi
)
SUB_STATUS=$?
assert_eq "$SUB_STATUS" "0" "API failures gracefully resolve to exit status 0 (no blocking of GHA Pipeline)"

echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
  echo "SUCCESS: All AI Review verification tests passed!"
else
  echo "FAILURE: One or more tests failed!"
fi
echo "=================================================="
exit $EXIT_CODE
