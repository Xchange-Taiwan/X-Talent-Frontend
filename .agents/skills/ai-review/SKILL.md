---
name: 'ai-review'
description: '執行低 Token 消耗的本地程式碼預審：優先透過 scripts/ai-review/run-local.mjs 呼叫免費的 Gemini (gemini-4-argon)，若無設定則退回單次 In-Context 自我檢查（嚴禁啟動 7 個本地 Sub-agents 消耗對話 Token）。'
---

Run a zero-sub-agent AI Review locally before or during PR preparation.

## Usage

```
/ai-review
```

## What this does (Zero Sub-Agent Policy)

To prevent burning massive primary-agent (Claude / Aside) tokens by spawning 7 parallel sub-agents in a loop, **NEVER launch `subagent` / `invoke_agent` for local AI review**. Instead:

1. **Run the Free Gemini Local Runner (`run-local.mjs`)**:

   ```bash
   node scripts/ai-review/run-local.mjs
   ```
   - When `GEMINI_API_KEY` is present in `.env.development.local`, this script directly calls the free `gemini-4-argon` API in parallel (matching the GitHub Actions CI pipeline 1:1) and prints a compact JSON summary with `overallRisk.level` (`low` / `medium` / `high`) and any `findings`.
   - When `GEMINI_API_KEY` is not configured on the developer's machine, the script exits 0 with `mode: "fallback-in-context"`.

2. **Fallback Single-Pass In-Context Check (When `mode == "fallback-in-context"`)**:
   - Do **NOT** spawn sub-agents. Perform a single-pass check directly in your current context against these 4 gates:
     1. **Business Logic & AC Coverage**: Every Acceptance Criterion from the `X-Talent-Tracker` ticket is implemented.
     2. **Correctness & Edge Cases**: Null/undefined states, loading/error states, and role boundaries (`visitor` / `mentee` / `mentor`) are handled safely.
     3. **Security & PII**: No secrets, tokens, emails, or passwords leak into logs or analytics payloads.
     4. **Unit Test Coverage**: New or modified hooks, schemas, services, and UI branches have corresponding Vitest unit/component tests (`pnpm test`).
