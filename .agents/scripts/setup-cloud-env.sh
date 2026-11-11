#!/usr/bin/env bash
set -euo pipefail

git config user.name "x-talent-cloud-agent[bot]"
git config user.email "x-talent-cloud-agent[bot]@users.noreply.github.com"

DEFAULT_DEV_API_URL="https://8br2lpf3ll.execute-api.ap-northeast-1.amazonaws.com/dev/api"
RESOLVED_API_URL="${NEXT_PUBLIC_API_URL:-$DEFAULT_DEV_API_URL}"

if [ -n "${BFF_OPENAPI_URL:-}" ]; then
  DERIVED_API="${BFF_OPENAPI_URL%/openapi.json}"
  if [[ "$DERIVED_API" != */api ]]; then
    DERIVED_API="${DERIVED_API%/}/api"
  fi
  RESOLVED_API_URL="$DERIVED_API"
fi

{
  printf '%s=%s\n' "NEXT_PUBLIC_API_URL" "$RESOLVED_API_URL"
  printf '%s=%s\n' "NEXTAUTH_URL" "http://localhost:3000"
  printf '%s=%s\n' "NEXTAUTH_SECRET" "${NEXTAUTH_SECRET:-}"
  printf '%s=%s\n' "GEMINI_API_KEY" "${GEMINI_API_KEY:-}"
  printf '%s=%s\n' "DESIGN_AUDIT_MENTOR_EMAIL" "${DESIGN_AUDIT_MENTOR_EMAIL:-}"
  printf '%s=%s\n' "DESIGN_AUDIT_MENTOR_PASSWORD" "${DESIGN_AUDIT_MENTOR_PASSWORD:-}"
  printf '%s=%s\n' "DESIGN_AUDIT_MENTEE_EMAIL" "${DESIGN_AUDIT_MENTEE_EMAIL:-}"
  printf '%s=%s\n' "DESIGN_AUDIT_MENTEE_PASSWORD" "${DESIGN_AUDIT_MENTEE_PASSWORD:-}"
} > .env.development.local
chmod 600 .env.development.local

{
  printf '%s=%s\n' "NEXT_PUBLIC_API_URL" "$RESOLVED_API_URL"
  printf '%s=%s\n' "NEXTAUTH_SECRET" "${NEXTAUTH_SECRET:-}"
  printf '%s=%s\n' "E2E_MENTOR_EMAIL" "${E2E_MENTOR_EMAIL:-}"
  printf '%s=%s\n' "E2E_MENTOR_PASSWORD" "${E2E_MENTOR_PASSWORD:-}"
  printf '%s=%s\n' "E2E_MENTEE_EMAIL" "${E2E_MENTEE_EMAIL:-}"
  printf '%s=%s\n' "E2E_MENTEE_PASSWORD" "${E2E_MENTEE_PASSWORD:-}"
} > .env.e2e.local
chmod 600 .env.e2e.local

# Un-ignore .agents/tmp in .gitignore during headless Cloud CI runs so Gemini
# CLI read_file can immediately read .agents/tmp/ticket-spec.md without hitting
# ignore-pattern rejections, while keeping .gitignore clean via --skip-worktree.
if [ -f .gitignore ]; then
  sed -i '/^\/\.agents\/tmp\//d' .gitignore || true
  git update-index --skip-worktree .gitignore 2>/dev/null || true
fi

# Strip external npx genable-mcp startup overhead and allow reading .agents/tmp
# in headless Cloud CI runs (supports both Gemini CLI v1 and v2 context schema).
if [ -f .gemini/settings.json ] && command -v jq >/dev/null 2>&1; then
  jq 'del(.mcpServers) | .fileFiltering = ((.fileFiltering // {}) + {"respectGitIgnore": false, "respectGeminiIgnore": false}) | .context = ((.context // {}) + {"fileFiltering": {"respectGitIgnore": false, "respectGeminiIgnore": false}})' .gemini/settings.json > .gemini/settings.json.tmp && mv .gemini/settings.json.tmp .gemini/settings.json || true
  git update-index --skip-worktree .gemini/settings.json 2>/dev/null || true
fi

mkdir -p .git/info .git/hooks
# Note: Do NOT add .agents/tmp/ to .git/info/exclude here because Gemini CLI's
# read_file checks git check-ignore (which reads .git/info/exclude) and would
# block reading .agents/tmp/ticket-spec.md and .agents/tmp/ticket-images/*.png!
# Instead, pre-commit hook + cloud-submit-pr.sh prevent .agents/tmp from ever being committed.
printf '\n.env.development.local\n.env.e2e.local\n.env*.local\n' >> .git/info/exclude
cat <<'HOOK' > .git/hooks/pre-commit
#!/usr/bin/env bash
if git diff --cached --name-only | grep -qE '(^|/)\.env(\..+)?$'; then
  git reset HEAD -- '.env*' '*/.env*' >/dev/null 2>&1 || true
  echo "Blocked staging of .env files in pre-commit hook." >&2
  exit 1
fi
if git diff --cached --name-only | grep -qE '^\.agents/tmp/'; then
  git reset HEAD -- '.agents/tmp' '.agents/tmp/*' >/dev/null 2>&1 || true
fi
HOOK
chmod +x .git/hooks/pre-commit
