#!/usr/bin/env bash

# Test verification script for load-config.sh
# Covers:
# 1. Normal JSON block extraction and variable parsing (independent of jq).
# 2. Defensive exit on malformed or missing JSON blocks.
# 3. Fallback to local project-config.md file when GitHub API fails.

EXIT_CODE=0
TEST_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'test-agent-config')

echo "=================================================="
echo "Running automated verification for load-config.sh"
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

# Helper function to assert failure
assert_fails() {
  local script_path="$1"
  local name="$2"
  # Run in subshell to prevent exit
  (
    # Mock cat/gh or environment to simulate failure
    source "$script_path" >/dev/null 2>&1
  )
  local status=$?
  if [ $status -ne 0 ]; then
    echo "  [PASS] $name (Failed as expected with code $status)"
  else
    echo "  [FAIL] $name: expected non-zero exit, got $status" >&2
    EXIT_CODE=1
  fi
}

# Ensure clean teardown
cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Create a valid mock markdown config
cat << 'EOF' > "$TEST_DIR/valid-config.md"
# AI Agent Project Configuration

This file centralizes all GitHub project board, repository, and status option identifiers.

```json
{
  "org": "Mock-Org",
  "repos": {
    "tracker": "Mock-Tracker-Repo",
    "frontend": "Mock-Frontend-Repo"
  },
  "project": {
    "number": 99,
    "id": "PVT_MOCK_ID"
  },
  "fields": {
    "status": {
      "id": "PVTSSF_MOCK_FIELD_ID",
      "options": {
        "backlog": "mock_backlog_id",
        "in_progress": "mock_in_progress_id",
        "pr_review": "mock_pr_review_id"
      }
    }
  }
}
```
EOF

# Create an invalid mock markdown config (no JSON fence)
cat << 'EOF' > "$TEST_DIR/invalid-config.md"
# AI Agent Project Configuration without JSON fence
Hello World!
EOF

# Create a load-config script override for testing that reads a specific file path
# to bypass gh api call.
# We will verify our parsing logic on this.
cat << 'EOF' > "$TEST_DIR/test-parser.sh"
# Extract and parse JSON
CONFIG_MD=$(cat "$MOCK_CONFIG_PATH")
CONFIG_MD=$(echo "$CONFIG_MD" | tr -d '\r')
CONFIG_JSON=$(echo "$CONFIG_MD" | sed -n '/^```json/,/^```$/p' | sed '1d;$d')

if [ -z "$CONFIG_JSON" ] || [ "$CONFIG_JSON" = "null" ]; then
  return 1 2>/dev/null || exit 1
fi

PARSED_VARS=$(node -e '
  try {
    const config = JSON.parse(process.argv[1]);
    const esc = s => "\x27" + String(s).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    console.log("export ORG=" + esc(config.org));
    console.log("export TRACKER_REPO=" + esc(config.repos.tracker));
    console.log("export FRONTEND_REPO=" + esc(config.repos.frontend));
    console.log("export PROJECT_NUMBER=" + esc(config.project.number));
    console.log("export PROJECT_ID=" + esc(config.project.id));
    console.log("export FIELD_ID=" + esc(config.fields.status.id));
    console.log("export BACKLOG_OPTION_ID=" + esc(config.fields.status.options.backlog));
    console.log("export IN_PROGRESS_OPTION_ID=" + esc(config.fields.status.options.in_progress));
    console.log("export PR_REVIEW_OPTION_ID=" + esc(config.fields.status.options.pr_review));
  } catch (e) {
    console.error("ERROR: Failed to parse configuration JSON: " + e.message);
    process.exit(1);
  }
' "$CONFIG_JSON")

if [ $? -ne 0 ] || [ -z "$PARSED_VARS" ]; then
  return 1 2>/dev/null || exit 1
fi

eval "$PARSED_VARS"
EOF

# --------------------------------------------------
# Test 1: Verify Normal JSON block extraction and variable parsing
# --------------------------------------------------
echo "Test 1: Valid Configuration Parsing"
MOCK_CONFIG_PATH="$TEST_DIR/valid-config.md"
source "$TEST_DIR/test-parser.sh"

assert_eq "$ORG" "Mock-Org" "ORG"
assert_eq "$TRACKER_REPO" "Mock-Tracker-Repo" "TRACKER_REPO"
assert_eq "$FRONTEND_REPO" "Mock-Frontend-Repo" "FRONTEND_REPO"
assert_eq "$PROJECT_NUMBER" "99" "PROJECT_NUMBER"
assert_eq "$PROJECT_ID" "PVT_MOCK_ID" "PROJECT_ID"
assert_eq "$FIELD_ID" "PVTSSF_MOCK_FIELD_ID" "FIELD_ID"
assert_eq "$BACKLOG_OPTION_ID" "mock_backlog_id" "BACKLOG_OPTION_ID"
assert_eq "$IN_PROGRESS_OPTION_ID" "mock_in_progress_id" "IN_PROGRESS_OPTION_ID"
assert_eq "$PR_REVIEW_OPTION_ID" "mock_pr_review_id" "PR_REVIEW_OPTION_ID"

# --------------------------------------------------
# Test 2: Verify Defensive exit on malformed or missing JSON blocks
# --------------------------------------------------
echo "Test 2: Defensive exit on malformed or missing JSON blocks"
MOCK_CONFIG_PATH="$TEST_DIR/invalid-config.md"
assert_fails "$TEST_DIR/test-parser.sh" "Aborts on malformed config"

# --------------------------------------------------
# Test 3: Fallback Logic Mock Validation
# --------------------------------------------------
echo "Test 3: Fallback to local project-config.md file"
# Run a test of load-config.sh in subshell with mocked gh
# Using our actual docs/agents/project-config.md file as local fallback
(
  # Mock gh api
  gh() {
    return 1
  }
  # Export gh mock
  export -f gh 2>/dev/null || true
  
  # Source actual script
  source .agents/scripts/load-config.sh
  
  # Assert fallbacked variables are loaded
  if [ "$ORG" = "Xchange-Taiwan" ]; then
    exit 0
  else
    exit 1
  fi
)
assert_eq "$?" "0" "Fallback to local project-config.md when gh api fails"

echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
  echo "All automated verifications PASSED successfully!"
else
  echo "Some verification tests FAILED." >&2
fi
echo "=================================================="

exit $EXIT_CODE
