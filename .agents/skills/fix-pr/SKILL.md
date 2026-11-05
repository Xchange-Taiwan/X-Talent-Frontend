---
name: 'fix-pr'
description: '在 PR 建立後自動監控並修復 GitHub Actions CI Checks（Unit/Integration Tests、Lint/Type-check、Security Audit、Bundle Size、Vercel Preview）與線上 AI Review 留言直到全綠收斂。'
---

Close the loop between "PR is open" and "PR is mergeable". This runs **after** a PR already exists (normally after `/submit-pr`). It is the post-PR counterpart to the local, pre-PR `/ai-review` used inside `/implement` — that one reviews code before a PR exists; this one reacts to what the real PR-level bots and CI actually reported.

## Usage

```
/fix-pr
/fix-pr <PR-url>
```

## Step 1 — Resolve the target PR & branch

- **Check the working tree first, unconditionally** — whether or not a branch switch is needed:
  - Bash: `git status --porcelain`
  - PowerShell: `git status --porcelain`
  - **If the tree is dirty, HALT.** Tell the user to commit or stash their changes first. Do not auto-stash, do not auto-commit changes that aren't yours — an uncommitted WIP change sitting on the branch when this skill starts committing fix rounds would get swept into a fix commit and pushed without the user ever agreeing to that.
- **Validate the argument before using it in any shell command**: it must be either empty, a bare PR number (`^[0-9]+$`), or a well-formed `https://github.com/<org>/<repo>/pull/<number>` URL. If it matches none of these, HALT and ask the user for a valid PR number or URL — never interpolate raw, unvalidated user input into a shell command. Once validated, always pass it quoted (`"$PR_URL"` / `"$PR_NUMBER"`), as in every example below.
- **With a PR URL argument**:
  - Run `gh pr view "$PR_URL" --json number,headRefName,url,state` to resolve the PR.
  - Checkout the PR branch: `gh pr checkout "$PR_NUMBER"` (handles fetch + checkout, including forks).
- **Without an argument**: use the current branch. Resolve its PR via `gh pr view --json number,headRefName,url,state`.
  - If there is no open PR for the current branch, HALT and tell the user to run `/submit-pr` first.
- **Either way, once on the target branch, sync with the remote**: `git pull`. Do this even when no branch switch happened — another actor (a teammate, or `code-quality.yml`'s own auto-fix commit from a previous round) may have pushed commits you don't have locally yet. Pushing a fix on top of stale local history risks a conflicting or overwriting push.

Keep `$PR_NUMBER` / `$PR_URL` around (re-derive in every standalone command execution — shell state does not persist across separate tool calls, only the working directory does, same caveat as `/submit-pr`).

## Step 2 — Iterative fix loop (max 3 rounds — token-efficient)

Repeat the following up to **3 times** (not 20, to prevent runaway token consumption). If still not converged after 3 rounds, HALT and report the remaining findings to the user (see Step 3).

### 2a. Gather signal (Zero-Token Terminal Wait)

- **Use the quiet wait script** instead of `gh pr checks --watch` (`gh pr checks --watch` floods the LLM context with hundreds of repeated `pending` lines every 10 seconds, wasting massive input tokens). While this script waits in the terminal, **0 LLM tokens are used**:
  - **On macOS/Linux (Bash/Zsh)**:
    ```bash
    bash .agents/scripts/wait-pr-checks.sh "$PR_NUMBER"
    ```
  - **On Windows (PowerShell)**:
    ```powershell
    & .agents/scripts/wait-pr-checks.ps1 $PR_NUMBER
    ```
- The script waits until all CI checks (including `AI Review: Final Summary` from the free Gemini CI pipeline) finish, verifies the comment author is `github-actions` / `github-actions[bot]`, and prints a compact summary (`CONVERGED=true` or `CONVERGED=false` + failed checks and AI Review findings).
- If `CONVERGED=true`, immediately exit the loop and proceed to Step 3 (Final report)!

### 2b. Classify Vercel daily-limit failures

If `Deploy PR Preview to Vercel` failed, first resolve the run ID for **this** commit's run of `deploy-pr.yml` — `gh pr checks` doesn't expose it directly:

```bash
BRANCH_NAME=$(git branch --show-current)
RUN_ID=$(gh run list --branch "$BRANCH_NAME" --workflow deploy-pr.yml --json databaseId --limit 1 --jq '.[0].databaseId')
```

Then check the run log before treating it as a real failure:

```bash
gh run view --log-failed "$RUN_ID" | grep -i "api-deployments-free-per-day"
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

### 2e. Local verification gate (before pushing — NO local sub-agents)

Do **NOT** spawn local `/ai-review` sub-agents here (the CI Gemini pipeline is already reviewing every push for free). Simply run the deterministic local checks and require all three to pass before pushing:

```bash
pnpm lint
pnpm type-check
pnpm test
```

**If any of these fail, do not push and do not loop back to 2a.** Fix the failure locally and re-run `pnpm lint` / `pnpm type-check` / `pnpm test` until all three pass, then continue to 2f. Do not push a commit you know will fail CI — this protects Vercel's daily deployment quota.

### 2f. Commit & push

- Stage only the files you changed. Never stage `.env` or secrets.
- Commit with a conventional commit message, e.g. `fix(<scope>): address AI review findings and pipeline failures`. Create a **new** commit each round — do not amend.
- Push: `git push` (branch already has upstream tracking from `/submit-pr`).

### 2g. Wait for the next round's signal

Loop back to 2a. `gh pr checks "$PR_NUMBER" --watch` will block until the new commit's checks finish.

## Step 3 — Final report

Report to the user in Traditional Chinese (繁體中文), no PR comment — chat output only:

- What was fixed this run (grouped by AI review finding vs. which pipeline).
- Current status of all 6 watched checks.
- If `deploy-pr.yml` is blocked on the Vercel daily limit (2b), say so explicitly and that it needs to be retried later or handled manually — do not imply the PR is broken.
- Anything out of scope that still failed (`e2e.yml`, etc.) — flag it, don't fix it.
- If the loop hit the 3-round cap without converging, list everything still outstanding and stop — do not keep retrying beyond the cap.
