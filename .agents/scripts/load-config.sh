#!/usr/bin/env bash

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
  return 1 2>/dev/null || exit 1
fi

# Remove Windows carriage returns to prevent sed/parsing failures
CONFIG_MD=$(echo "$CONFIG_MD" | tr -d '\r')

# Extract JSON block
CONFIG_JSON=$(echo "$CONFIG_MD" | sed -n '/^```json/,/^```$/p' | sed '1d;$d')

# Validate extracted JSON content
if [ -z "$CONFIG_JSON" ] || [ "$CONFIG_JSON" = "null" ]; then
  echo "ERROR: project-config.md is malformed or missing JSON block — aborting" >&2
  return 1 2>/dev/null || exit 1
fi

# Parse variables using Node.js to avoid any external jq dependency
eval $(node -e '
  try {
    const config = JSON.parse(process.argv[1]);
    console.log(`export ORG="${config.org}"`);
    console.log(`export TRACKER_REPO="${config.repos.tracker}"`);
    console.log(`export FRONTEND_REPO="${config.repos.frontend}"`);
    console.log(`export PROJECT_NUMBER="${config.project.number}"`);
    console.log(`export PROJECT_ID="${config.project.id}"`);
    console.log(`export FIELD_ID="${config.fields.status.id}"`);
    console.log(`export BACKLOG_OPTION_ID="${config.fields.status.options.backlog}"`);
    console.log(`export IN_PROGRESS_OPTION_ID="${config.fields.status.options.in_progress}"`);
    console.log(`export PR_REVIEW_OPTION_ID="${config.fields.status.options.pr_review}"`);
  } catch (e) {
    console.error("ERROR: Failed to parse configuration JSON: " + e.message);
    process.exit(1);
  }
' "$CONFIG_JSON")

if [ $? -ne 0 ]; then
  return 1 2>/dev/null || exit 1
fi
