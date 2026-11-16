---
name: 'ai-review'
description: '執行雙軌 AI 程式碼預審：本地端單次輕量呼叫 scripts/ai-review/run-local.mjs（不啟動 7 個本地 Sub-agents），雲端環境則透過 scripts/cloud-converge-loop.mjs 搭配免費無限流量 Gemini (gemini-4-carbon) 自動執行最多 20 輪 AI Review 與 Playwright E2E 自癒收斂迴圈。'
---

Run a zero-sub-agent AI Review locally, or run the 20-round AI Review + Playwright E2E convergence loop in the cloud before opening a PR.

## Usage

```
/ai-review
```

## Dual-Track Policy (Local Lightweight vs. Cloud 20-Round Convergence)

### 1. Local Developer Mode (Lightweight, Zero Sub-Agent Overhead)

Because local engineers may use paid/quota-limited AI models (Claude, Cursor, Aside), **NEVER launch `subagent` / `invoke_agent` for local AI review**. Instead:

1. **Run the Single-Pass Free Gemini Local Runner (`run-local.mjs`)**:

   ```bash
   node scripts/ai-review/run-local.mjs
   ```
   - When `GEMINI_API_KEY` is present in `.env.development.local`, this script directly calls the free `gemini-4-carbon` API in parallel (matching the GitHub Actions CI pipeline 1:1) and prints a compact JSON summary with `overallRisk.level` (`low` / `medium` / `high`), `requirementCoverage`, and `findings`.
   - When `GEMINI_API_KEY` is not configured on the developer's machine, the script exits 0 with `mode: "fallback-in-context"`.

2. **Promote Local Branch to Cloud for 20-Round Review + E2E (`pnpm cloud:promote`)**:
   - Once local feature coding is ready, you can hand off your current branch directly to the free Cloud GitHub Actions VM to run up to 20 rounds of AI Review + Playwright E2E self-healing and open the PR automatically:

   ```bash
   pnpm cloud:promote
   ```

### 2. Cloud VM Mode (Up to 20 Rounds AI Review + Playwright E2E Loop)

When running on GitHub Actions (`cloud-implement.yml` / `cloud-fix-pr.yml`) or explicitly invoking the convergence loop:

```bash
pnpm cloud:converge --ticket=<issue-number> --max-rounds=20 --run-e2e=true
```

- Executes up to **20 rounds** of:
  1. `pnpm lint`, `pnpm type-check`, and `pnpm test` (Vitest unit tests)
  2. `pnpm test:e2e:mock --workers=4` + any modified `e2e/tests/**/*.spec.ts` files
  3. 7-agent parallel `node scripts/ai-review/run-local.mjs` (`gemini-4-carbon`), including checking that any added or modified UI components under `src/components/**/*.tsx` have up-to-date companion `.stories.tsx` files in the same PR
- Automatically invokes Gemini CLI (`gemini-4-carbon`) to fix any findings or E2E failures at the end of each round, and **early-exits immediately** once `overallRisk.level === 'low'`, `0 findings`, and all unit + E2E tests pass.
