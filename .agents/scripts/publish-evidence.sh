#!/usr/bin/env bash
#
# Publishes screenshot/evidence files to a dedicated orphan branch
# (default: pr-evidence) without touching the caller's working tree,
# index, or current branch. Prints one raw.githubusercontent.com URL per
# input file, in order, pinned to the commit sha that published it.
#
# Usage: publish-evidence.sh <file> [<file> ...]
# Env:   EVIDENCE_BRANCH (default: pr-evidence)

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: publish-evidence.sh <file> [<file> ...]" >&2
  exit 2
fi

for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: file not found: $f" >&2
    exit 1
  fi
done

EVIDENCE_BRANCH="${EVIDENCE_BRANCH:-pr-evidence}"

REMOTE_URL=$(git remote get-url origin)
# origin may be an https URL with embedded credentials (e.g. `gh auth
# setup-git` writes `https://oauth2:<token>@github.com/...`) - strip any
# `user:pass@` userinfo segment before the host so it never leaks into the
# printed raw.githubusercontent.com URLs below.
REPO_SLUG=$(echo "$REMOTE_URL" | sed -E 's#^git@github\.com:##; s#^https://([^@/]+@)?github\.com/##; s#\.git$##')
if [ -z "$REPO_SLUG" ]; then
  echo "ERROR: could not resolve owner/repo from origin remote ($REMOTE_URL)" >&2
  exit 1
fi

BRANCH=$(git branch --show-current)
if [ -z "$BRANCH" ]; then
  echo "ERROR: not on a branch (detached HEAD)" >&2
  exit 1
fi
BRANCH_SLUG=$(echo "$BRANCH" | tr '/' '-')
PREFIX="$BRANCH_SLUG/$(date -u +%Y%m%dT%H%M%SZ)"

PARENT_SHA=$(git ls-remote origin "refs/heads/$EVIDENCE_BRANCH" | cut -f1 || true)

SCRATCH_INDEX=$(mktemp -u)
cleanup() { rm -f "$SCRATCH_INDEX"; }
trap cleanup EXIT

export GIT_INDEX_FILE="$SCRATCH_INDEX"

if [ -n "$PARENT_SHA" ]; then
  git read-tree "$PARENT_SHA"
else
  MARKER=$(mktemp)
  printf 'Evidence branch for PR screenshots, published by .agents/scripts/publish-evidence.sh.\n\nThis is an orphan branch: it shares no history with the repository code\nbranches. Pull request bodies link into it by commit sha, so links stay\nstable even after later runs overwrite the same paths at the branch tip.\n' > "$MARKER"
  MARKER_BLOB=$(git hash-object -w "$MARKER")
  rm -f "$MARKER"
  git update-index --add --cacheinfo 100644 "$MARKER_BLOB" ".pr-evidence"
fi

INDEX=0
declare -a REL_PATHS
for f in "$@"; do
  BLOB=$(git hash-object -w "$f")
  FILENAME=$(basename "$f")
  REL_PATH="$PREFIX/$INDEX-$FILENAME"
  git update-index --add --cacheinfo 100644 "$BLOB" "$REL_PATH"
  REL_PATHS+=("$REL_PATH")
  INDEX=$((INDEX + 1))
done

NEW_TREE=$(git write-tree)

COMMIT_MSG="evidence: $BRANCH"
if [ -n "$PARENT_SHA" ]; then
  COMMIT_SHA=$(echo "$COMMIT_MSG" | git commit-tree "$NEW_TREE" -p "$PARENT_SHA")
else
  COMMIT_SHA=$(echo "$COMMIT_MSG" | git commit-tree "$NEW_TREE")
fi

git push origin "$COMMIT_SHA:refs/heads/$EVIDENCE_BRANCH" >&2

for REL_PATH in "${REL_PATHS[@]}"; do
  echo "https://raw.githubusercontent.com/$REPO_SLUG/$COMMIT_SHA/$REL_PATH"
done
