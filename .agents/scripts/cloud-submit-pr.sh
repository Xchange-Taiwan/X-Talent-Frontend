#!/usr/bin/env bash
#
# Deterministic Phase 3 submission script for Cloud AI workflows
# (cloud-implement.yml and cloud-fix-pr.yml).
#
# Replaces the slow Phase 3 `npx gemini` invocation so Phase 3 completes in
# ~15 seconds without redundant full Vitest runs, second `pnpm dev` startups,
# or Gemini CLI policy/read_file blocks.

set -euo pipefail

MODE="${1:-implement}"
CLEAN_TICKET=$(printf '%s' "${TICKET_NUMBER:-}" | tr -cd '0-9')
CLEAN_PR=$(printf '%s' "${PR_NUMBER:-}" | tr -cd '0-9')

TMP_SUMMARY=$(mktemp)
TMP_SPEC=$(mktemp)
TMP_EVIDENCE_URLS=$(mktemp)
TMP_EXISTING_BODY=$(mktemp)
TMP_COMMIT_MSG=$(mktemp)
TMP_PR_TITLE=$(mktemp)
TMP_PR_BODY=$(mktemp)

cleanup() {
  rm -f "$TMP_SUMMARY" "$TMP_SPEC" "$TMP_EVIDENCE_URLS" "$TMP_EXISTING_BODY" "$TMP_COMMIT_MSG" "$TMP_PR_TITLE" "$TMP_PR_BODY"
  rm -f .env.development.local .env.e2e.local
}
trap cleanup EXIT

if [ -f .agents/tmp/cloud-converge-summary.md ]; then
  cp .agents/tmp/cloud-converge-summary.md "$TMP_SUMMARY"
fi

if [ -f .agents/tmp/ticket-spec.md ]; then
  cp .agents/tmp/ticket-spec.md "$TMP_SPEC"
fi

# 1. Ensure we are on a valid feature/fix branch before publishing evidence or committing
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ "$MODE" = "implement" ]; then
  if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "develop" ] || [ "$CURRENT_BRANCH" = "main" ]; then
    if [ -n "$CLEAN_TICKET" ]; then
      bash .agents/scripts/link-ticket-branch.sh "$CLEAN_TICKET" || true
      CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    fi
  elif [ -n "$CLEAN_TICKET" ]; then
    bash .agents/scripts/link-ticket-branch.sh "$CLEAN_TICKET" "$CURRENT_BRANCH" --no-checkout --no-board-update || true
  fi
fi

if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "develop" ] || [ "$CURRENT_BRANCH" = "main" ]; then
  echo "ERROR: Refusing to run Phase 3 directly on branch '${CURRENT_BRANCH:-detached}'." >&2
  exit 1
fi

# 2. If any screenshots were already captured in .agents/tmp/evidence/*, publish them
shopt -s nullglob
EVIDENCE_FILES=(.agents/tmp/evidence/*.png .agents/tmp/evidence/*.jpg .agents/tmp/evidence/*.jpeg .agents/tmp/evidence/*.webp)
shopt -u nullglob
if [ "${#EVIDENCE_FILES[@]}" -gt 0 ]; then
  bash .agents/scripts/publish-evidence.sh "${EVIDENCE_FILES[@]}" > "$TMP_EVIDENCE_URLS" || true
fi

# 3. Clean up temporary cloud files and restore skip-worktree files individually from HEAD before staging
rm -f .env.development.local .env.e2e.local .gemini/settings.json.tmp
rm -rf .agents/tmp
bash .agents/scripts/unstage-cloud-locks.sh --restore-worktree

# Collapse any resumed [cloud-wip-checkpoint] commits into one clean feature commit when no open PR exists yet
git fetch origin develop --quiet 2>/dev/null || true
if git log "origin/develop..HEAD" --format=%s 2>/dev/null | grep -Fq '[cloud-wip-checkpoint]'; then
  if OPEN_PR_CHECK=$(gh pr list --head "$CURRENT_BRANCH" --state open --json number --jq 'length' 2>/dev/null) && [ "$OPEN_PR_CHECK" = "0" ]; then
    git reset --soft origin/develop
  fi
fi

# 4. Stage and commit any uncommitted working tree changes (allow .env.example/.sample/.template while blocking secret .env files)
git add -A
bash .agents/scripts/unstage-cloud-locks.sh --restore-worktree

if ! git diff --cached --quiet; then
  TMP_STAGED_LIST=$(mktemp)
  git diff --cached --name-only > "$TMP_STAGED_LIST"
  node --input-type=commonjs - "$CLEAN_TICKET" "$CURRENT_BRANCH" "$TMP_SPEC" "$TMP_EVIDENCE_URLS" "$TMP_STAGED_LIST" "$TMP_COMMIT_MSG" <<'EOF'
const fs = require('fs');
const [ticket, branch, specPath, evidencePath, stagedListPath, outPath] = process.argv.slice(2);
const specText = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : '';
const evidenceUrls = fs.existsSync(evidencePath)
  ? fs.readFileSync(evidencePath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  : [];
const stagedFiles = fs.existsSync(stagedListPath)
  ? fs.readFileSync(stagedListPath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  : [];

const titleMatch = specText.match(/^title:\s*(.+)$/m);
const rawIssueTitle = titleMatch ? titleMatch[1].trim() : '';
const cleanedIssueTitle = rawIssueTitle
  .replace(/^(\[[^\]]+\]\s*)+/, '')
  .trim();

const type = branch.startsWith('fix/') || /\[bug\]/i.test(rawIssueTitle) ? 'fix' : 'feat';
let scope = 'ui';
if (stagedFiles.some(f => f.includes('notification'))) scope = 'notification';
else if (stagedFiles.some(f => f.includes('mentor-pool'))) scope = 'mentor-pool';
else if (stagedFiles.some(f => f.includes('reservation'))) scope = 'reservation';
else if (stagedFiles.some(f => f.includes('profile'))) scope = 'profile';
else if (stagedFiles.some(f => f.includes('onboarding'))) scope = 'onboarding';
else if (stagedFiles.some(f => f.includes('auth'))) scope = 'auth';
else if (stagedFiles.every(f => f.endsWith('.stories.tsx') || f.endsWith('.test.tsx') || f.endsWith('.test.ts'))) scope = 'storybook';

const slugSubject = branch
  .replace(/^(feat|fix|chore|refactor|test)\//, '')
  .replace(/^\d+-/, '')
  .replace(/-/g, ' ')
  .trim();
const subjectText = cleanedIssueTitle || slugSubject || `implement ticket changes`;
const tag = ticket ? ` (X-Tracker #${ticket})` : '';
const header = `${type}(${scope}): ${subjectText}${tag}`;

const fileBullets = stagedFiles.slice(0, 25).map(f => `- \`${f}\``).join('\n');
const screenshotSection = evidenceUrls.length > 0
  ? evidenceUrls.map((u, i) => `![evidence-${i + 1}](${u})`).join('\n')
  : 'N/A';
const footer = ticket
  ? `\nRef: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/${ticket}\n`
  : '';

const fullMsg = [
  header,
  '',
  'Automated cloud implementation and pre-PR convergence verification:',
  fileBullets,
  '',
  '## Screenshot',
  '',
  screenshotSection,
  footer,
].join('\n');

fs.writeFileSync(outPath, fullMsg, 'utf8');
EOF
  rm -f "$TMP_STAGED_LIST"
  git commit -F "$TMP_COMMIT_MSG"
fi

# 5. Resolve existing open PR before pushing so re-initialized branches without an open PR can force-with-lease cleanly
EXISTING_PR="$CLEAN_PR"
if [ -z "$EXISTING_PR" ]; then
  EXISTING_PR=$(gh pr list --head "$CURRENT_BRANCH" --state open --json number --jq '.[0].number // empty' 2>/dev/null || echo "")
fi

EXISTING_BASE_REF="develop"
META_LOADED="false"
if [ -n "$EXISTING_PR" ]; then
  if PR_META=$(gh pr view "$EXISTING_PR" --json title,body,baseRefName 2>/dev/null) && [ -n "$PR_META" ]; then
    META_LOADED="true"
    printf '%s' "$PR_META" | jq -r '.body // ""' > "$TMP_EXISTING_BODY" 2>/dev/null || true
    EXISTING_BASE_REF=$(printf '%s' "$PR_META" | jq -r '.baseRefName // "develop"' 2>/dev/null || echo "develop")
    if [ -z "$CLEAN_TICKET" ]; then
      CLEAN_TICKET=$(printf '%s' "$PR_META" | jq -r '(.title // "") + "\n" + (.body // "")' | grep -oEi 'X-Talent-Tracker/issues/[0-9]+|\(X-Tracker[[:space:]]*#[0-9]+\)' | head -n 1 | tr -cd '0-9' || echo "")
    fi
  fi
fi

git fetch origin "$EXISTING_BASE_REF" --quiet 2>/dev/null || true

if [ "$MODE" = "implement" ] && [ -z "$EXISTING_PR" ]; then
  AHEAD_COUNT=$(git rev-list --count "origin/${EXISTING_BASE_REF}..HEAD" 2>/dev/null || echo "0")
  if [ "${AHEAD_COUNT:-0}" -eq 0 ]; then
    echo "ERROR: Branch '$CURRENT_BRANCH' has 0 commits ahead of origin/${EXISTING_BASE_REF}; refusing to open empty PR." >&2
    exit 1
  fi
  git push -u origin "$CURRENT_BRANCH" || git push --force-with-lease -u origin "$CURRENT_BRANCH"
else
  if ! git push -u origin "$CURRENT_BRANCH"; then
    git pull --rebase origin "$CURRENT_BRANCH" && git push -u origin "$CURRENT_BRANCH"
  fi
fi

# 6. Create or update Pull Request with rich AI-synthesized Traditional Chinese description
LAST_SUBJECT=$(git log -1 --format=%s 2>/dev/null || echo "")

node scripts/generate-pr-description.mjs \
  --ticket="$CLEAN_TICKET" \
  --branch="$CURRENT_BRANCH" \
  --last-subject="$LAST_SUBJECT" \
  --spec-file="$TMP_SPEC" \
  --summary-file="$TMP_SUMMARY" \
  --evidence-file="$TMP_EVIDENCE_URLS" \
  --existing-body-file="$TMP_EXISTING_BODY" \
  --base-ref="origin/${EXISTING_BASE_REF}" \
  --title-out="$TMP_PR_TITLE" \
  --body-out="$TMP_PR_BODY"

PR_TITLE=$(cat "$TMP_PR_TITLE")
if [ -z "$EXISTING_PR" ]; then
  if [ "$MODE" = "implement" ]; then
    DRAFT_FLAG="--draft"
    if [ "${CLOUD_PR_DRAFT:-true}" = "false" ]; then
      DRAFT_FLAG=""
    fi
    # Open as Draft PR by default so Vercel Preview deployment only fires once
    # after online AI Review + CI pass and Worker promotes PR to Ready for Review.
    # shellcheck disable=SC2086
    gh pr create $DRAFT_FLAG --base "$EXISTING_BASE_REF" --head "$CURRENT_BRANCH" --title "$PR_TITLE" --body-file "$TMP_PR_BODY"
  fi
else
  if [ "$MODE" = "implement" ]; then
    gh pr edit "$EXISTING_PR" --title "$PR_TITLE" --body-file "$TMP_PR_BODY" || true
  elif [ "$META_LOADED" = "true" ]; then
    gh pr edit "$EXISTING_PR" --body-file "$TMP_PR_BODY" || true
  fi
fi

if [ "$MODE" = "implement" ]; then
  node .agents/scripts/hooks/gemini-verify-board-status.mjs --claude || true
fi
