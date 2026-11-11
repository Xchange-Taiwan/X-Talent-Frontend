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

# Install static ripgrep (rg) with verified SHA-256 checksum on x86_64 Linux runners
# so Gemini CLI never falls back to slow single-threaded JS GrepTool.
if ! command -v rg >/dev/null 2>&1 && [ "$(uname -s 2>/dev/null || echo '')" = "Linux" ] && [ "$(uname -m 2>/dev/null || echo '')" = "x86_64" ]; then
  RG_TMP_TAR=$(mktemp)
  RG_TMP_DIR=$(mktemp -d)
  if curl -fsSL --retry 2 "https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-x86_64-unknown-linux-musl.tar.gz" -o "$RG_TMP_TAR" 2>/dev/null; then
    if echo "4cf9f2741e6c465ffdb7c26f38056a59e2a2544b51f7cc128ef28337eeae4d8e  $RG_TMP_TAR" | sha256sum -c - >/dev/null 2>&1; then
      tar -xzf "$RG_TMP_TAR" -C "$RG_TMP_DIR" --strip-components=1 ripgrep-14.1.1-x86_64-unknown-linux-musl/rg 2>/dev/null || true
      if [ -x "$RG_TMP_DIR/rg" ]; then
        sudo install -m 0755 "$RG_TMP_DIR/rg" /usr/local/bin/rg 2>/dev/null || true
      fi
    fi
  fi
  rm -rf "$RG_TMP_TAR" "$RG_TMP_DIR"
fi

# Strip external npx genable-mcp startup overhead, redundant AfterAgent hooks,
# and allow reading .agents/tmp in headless Cloud CI runs.
if [ -f .gemini/settings.json ] && command -v jq >/dev/null 2>&1; then
  jq 'del(.mcpServers, .hooks) | .fileFiltering = ((.fileFiltering // {}) + {"respectGitIgnore": false, "respectGeminiIgnore": false}) | .context = ((.context // {}) + {"fileFiltering": {"respectGitIgnore": false, "respectGeminiIgnore": false}})' .gemini/settings.json > .gemini/settings.json.tmp && mv .gemini/settings.json.tmp .gemini/settings.json || true
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
