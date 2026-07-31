---
name: fix-pr
description: 'Fetch the AI Review bot comment on an open pull request, fix its findings, and iteratively fix failing PR pipelines (tests, lint/type-check, security audit, bundle-size budget, Vercel build) until everything is green — except the Vercel free-tier daily deployment cap, which is skipped and reported, not fixed.'
disable-model-invocation: true
---

Close the loop between "PR is open" and "PR is mergeable". This runs **after** a PR already exists (normally after `/submit-pr`). It is the post-PR counterpart to the local, pre-PR `/ai-review` used inside `/implement` — that one reviews code before a PR exists; this one reacts to what the real PR-level bots and CI actually reported.

## Usage

```
/fix-pr
/fix-pr <PR-url>
```

## Step 1 — Resolve the target PR & branch

- **With a PR URL argument**:
  - Run `gh pr view <url> --json number,headRefName,url,state` to resolve the PR.
  - If the PR's `headRefName` differs from the current branch, check the working tree first:
    - Bash: `git status --porcelain`
    - PowerShell: `git status --porcelain`
  - **If the tree is dirty, HALT.** Tell the user to commit or stash their changes on the current branch first. Do not auto-stash, do not auto-commit changes that aren't yours.
  - Once clean, checkout the PR branch: `gh pr checkout <number>` (handles fetch + checkout, including forks).
- **Without an argument**: use the current branch. Resolve its PR via `gh pr view --json number,headRefName,url,state`.
  - If there is no open PR for the current branch, HALT and tell the user to run `/submit-pr` first.

Keep `$PR_NUMBER` / `$PR_URL` around (re-derive in every standalone command execution — shell state does not persist across separate tool calls, only the working directory does, same caveat as `/submit-pr`).

## Step 2 — Iterative fix loop (max 20 rounds)

Repeat the following up to **20 times**. If still not converged after 20 rounds, HALT (see Step 3).

### 2a. Gather signal

- **Pipeline check status first** — wait for PR checks to finish before reading anything they produce:

  ```bash
  gh pr checks $PR_NUMBER --watch
  ```

  In scope for auto-fix (by their `gh pr checks` name):
  - `Unit & Integration Tests` (test.yml)
  - `Format and Lint Check` (code-quality.yml)
  - `Deploy PR Preview to Vercel` (deploy-pr.yml) — **only the build step**, see 2b for the deploy-quota exception
  - `Security Audit & Unused Dependencies` (security.yml)
  - `Bundle Size Budget Check` (performance.yml)
  - `AI Review: Final Summary` (ai-review.yml) — not a pass/fail gate itself, but it's the job that (re)writes the AI Review comment, so it **must** be waited on here too

  **This ordering matters**: `AI Review: Final Summary` overwrites the same PR comment (via its marker) on every push. If the comment is fetched before this check finishes, a mid-loop round reads the _previous_ round's stale comment — leading to fixes for already-resolved findings, or a false "converged" verdict while the real, current findings haven't loaded yet. Always finish waiting on checks before reading the comment below.

- **AI Review findings** — now that `AI Review: Final Summary` has completed, fetch PR comments and find the one from the AI Review pipeline by its marker (`<!-- ai-review-pipeline -->`, defined in `scripts/ai-review/lib/format-comment.mjs`):

  ```bash
  gh pr view $PR_NUMBER --json comments --jq '.comments[] | select(.body | contains("<!-- ai-review-pipeline -->")) | .body'
  ```

  This is the **only** AI reviewer in this repo (`.github/workflows/ai-review.yml`, Gemini-based) — there is no CodeRabbit or similar. The comment has sections per category (Business Logic, Security, Correctness, Performance, Testing, Architecture) that each either say "no findings" or list concrete `file:line` / issue / why / suggested fix entries, plus an `Overall Risk` line (`low` / `medium` / `high`). Note the comment explicitly says it's advisory and does not block merge — that's a GitHub-level fact, not a reason to skip fixing real findings.

  Out of scope (never auto-fixed, but still call out failures in the final report so nothing is silently missed): `e2e.yml` and anything else not listed above.

  **Note**: `code-quality.yml` auto-fixes Prettier/ESLint issues itself and pushes a `[skip ci]` commit directly to the PR branch when it can. So a "failure" on that check that matters is only: unfixable ESLint errors, TypeScript type errors, or design-token drift (`pnpm run generate:tokens:check`) — not plain formatting. After this check runs, **always `git pull` before making further local edits**, since it may have pushed a commit you don't have locally yet.

### 2b. Classify Vercel daily-limit failures

If `Deploy PR Preview to Vercel` failed, check the run log before treating it as a real failure:

```bash
gh run view --log-failed <run-id> | grep -i "api-deployments-free-per-day"
```

If the log contains `code: "api-deployments-free-per-day"` (Vercel Hobby plan's "Resource is limited - try again in N hours" error), this is **not a code problem**. Do not attempt a fix, do not count it against the retry budget, do not retry it. Record it for the final report and treat this check as excluded from the convergence condition below.

If the deploy failure is anything else (build error, missing env var, etc.), treat it as a real, in-scope failure to fix.

### 2c. Decide if this round is done

Converged (exit the loop successfully) when **all** of the following hold:

- Every AI Review section has no findings (or `Overall Risk` is `low`), **and**
- `test.yml`, `code-quality.yml`, `security.yml`, `performance.yml` all pass, **and**
- `deploy-pr.yml` either passes or fails only due to the Vercel daily-limit (2b).

If converged, go to Step 3 (success report).

### 2d. Apply fixes

For whatever is still outstanding:

- **AI Review findings**: address each one directly in the code, using the `file`/`line`/`issue`/`fix` guidance from the comment as a starting point, not a literal patch to apply blindly — verify the suggested fix actually matches the current code before applying it.
- **Test failures**: run `pnpm test` locally to reproduce, fix the underlying code or test.
- **Lint/type-check failures**: run `pnpm lint:fix` then `pnpm type-check`; fix whatever ESLint/TS can't auto-fix. If `generate:tokens:check` is failing, resolve the design-token drift it reports.
- **Security audit failures**: run `pnpm audit` locally. For critical vulnerabilities, upgrade/patch the offending dependency (`pnpm update <pkg>`, or a `pnpm.overrides` entry in `package.json` if no direct upgrade path exists). For unused dependencies (`depcheck`), remove them from `package.json` — unless they're legitimately config-only, in which case they belong in the `--ignores` list in `security.yml`, not deleted from the lockfile.
- **Bundle size budget failures**: identify the over-budget route(s) from the check output, reduce its bundle via code-splitting, dynamic `import()`, or removing dead weight — budgets are defined in `performance.yml`'s `env` block (`PAGE_SIZE_FAIL_KB`, `FIRST_LOAD_FAIL_KB`, etc.).
- **Vercel build failures (non-quota)**: reproduce with `vercel build` or `pnpm build` locally and fix the underlying error.

### 2e. Local re-review gate (before pushing)

Before touching lint/type-check/test, call the local `/ai-review` skill on the fixes you just made. This is the same gate `/implement` uses before a PR exists — here it's a second, local pass to catch anything before spending an outer-loop round (2a-2g pushes real commits and burns CI + Vercel deploy quota, the scarce resource this skill exists to protect).

- Run `/ai-review`.
- Derive the verdict from `overallRisk.level`: `low` → pass, continue below. `medium`/`high` → fix the findings it raised and re-run `/ai-review` again.
- This inner fix-and-re-review cycle is bounded the same way as `/implement`'s: up to 20 attempts. If still not `low` after 20 attempts, stop looping locally and proceed anyway — note the unresolved local findings in this round's commit/report rather than blocking forever on it.

Only once `/ai-review` is `low` (or the inner cap above was hit), run the deterministic local checks and require all to pass:

```bash
pnpm lint
pnpm type-check
pnpm test
```

Do not push a commit you know will fail CI — this wastes CI time and, more importantly, burns Vercel's daily deployment quota (`deploy-pr.yml` deploys on every push), which is the exact scarce resource this skill is designed to protect (2b).

### 2f. Commit & push

- Stage only the files you changed. Never stage `.env` or secrets.
- Commit with a conventional commit message, e.g. `fix(<scope>): address AI review findings and pipeline failures`. Create a **new** commit each round — do not amend.
- Push: `git push` (branch already has upstream tracking from `/submit-pr`).

### 2g. Wait for the next round's signal

Loop back to 2a. `gh pr checks $PR_NUMBER --watch` will block until the new commit's checks finish.

## Step 3 — Final report

Report to the user in Traditional Chinese (繁體中文), no PR comment — chat output only:

- What was fixed this run (grouped by AI review finding vs. which pipeline).
- Current status of all 6 watched checks.
- If `deploy-pr.yml` is blocked on the Vercel daily limit (2b), say so explicitly and that it needs to be retried later or handled manually — do not imply the PR is broken.
- Anything out of scope that still failed (`e2e.yml`, etc.) — flag it, don't fix it.
- If the loop hit the 20-round cap without converging, list everything still outstanding and stop — do not keep retrying beyond the cap.
