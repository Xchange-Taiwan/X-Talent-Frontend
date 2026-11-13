#!/usr/bin/env bash
# Shared helper to unstage cloud workspace lock files, temporary agent files,
# and secret .env files while preserving legitimate template files
# (.env.example, .env.sample, .env.template).
#
# Usage:
#   bash .agents/scripts/unstage-cloud-locks.sh [--restore-worktree]

set -uo pipefail

RESTORE_WORKTREE="false"
for arg in "$@"; do
  if [ "$arg" = "--restore-worktree" ]; then
    RESTORE_WORKTREE="true"
  fi
done

if [ "$RESTORE_WORKTREE" = "true" ]; then
  for locked_file in .gitignore .gemini/settings.json; do
    git update-index --no-skip-worktree "$locked_file" 2>/dev/null || true
  done
fi

while IFS= read -r secret_env_file; do
  if [ -n "$secret_env_file" ]; then
    git reset HEAD -- "$secret_env_file" >/dev/null 2>&1 || true
  fi
done < <(git diff --cached --name-only 2>/dev/null | grep -E '(^|/)\.env(\..+)?$' | grep -vE '\.env\.(example|sample|template)$' || true)

for excl_spec in '.agents/tmp*' '.gitignore' '.gemini/settings.json'; do
  git reset HEAD -- "$excl_spec" >/dev/null 2>&1 || true
done

if [ "$RESTORE_WORKTREE" = "true" ]; then
  for locked_file in .gitignore .gemini/settings.json; do
    git checkout HEAD -- "$locked_file" 2>/dev/null || true
  done
fi
