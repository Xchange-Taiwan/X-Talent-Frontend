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

# Parse variables using jq
export ORG=$(echo "$CONFIG_JSON" | jq -r '.org')
export TRACKER_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.tracker')
export FRONTEND_REPO=$(echo "$CONFIG_JSON" | jq -r '.repos.frontend')
export PROJECT_NUMBER=$(echo "$CONFIG_JSON" | jq -r '.project.number')
export PROJECT_ID=$(echo "$CONFIG_JSON" | jq -r '.project.id')
export FIELD_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.id')
export BACKLOG_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.backlog')
export IN_PROGRESS_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.in_progress')
export PR_REVIEW_OPTION_ID=$(echo "$CONFIG_JSON" | jq -r '.fields.status.options.pr_review')
