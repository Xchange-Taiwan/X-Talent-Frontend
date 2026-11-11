#!/usr/bin/env node
/**
 * Pre-flight Ticket Scope Gate & Mixed-Ticket Scope Guidance Generator
 * for X-Talent-Frontend Cloud AI workflows (`cloud-implement.yml`).
 *
 * Layer 1: Deterministically rejects CLOSED tickets, umbrella [Epic] tickets,
 * [Spike]/[提案] planning tickets, and explicit non-FE role-tagged tickets
 * ([BE], [Data], [PM], [QA] without FE) in 0ms before creating branches.
 *
 * Layer 2: Uses Gemini (`gemini-4-carbon`) on untagged business tickets
 * (e.g. `[Feature] 回饋：...`) to distinguish:
 *   - `non_frontend` (e.g. #732 backend masking, #739 pure domain rule) -> skip VM
 *   - `mixed_fe_be` (e.g. #733 / #734 backend email + frontend notification routing)
 *     -> allow VM and emit explicit frontend-only implementation boundaries!
 *   - `frontend_only` -> allow VM normally
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callGemini } from './ai-review/lib/gemini.mjs';

const EPIC_OR_RESEARCH_TAGS = new Set(['epic', 'spike', '提案', 'rfc', 'adr']);

const FRONTEND_ROLE_MARKERS = new Set([
  'fe',
  'frontend',
  '前端',
  'ui',
  'ux',
  'storybook',
]);

const NON_FRONTEND_ROLE_MARKERS = new Set([
  'be',
  'backend',
  '後端',
  'data',
  '數據',
  'pm',
  'qa',
  'ops',
  'infra',
  '信件',
  '資料層',
  '資料庫',
  'db',
]);

export function parseIssueSpecMarkdown(rawText = '') {
  const text = String(rawText ?? '');
  const lines = text.split(/\r?\n/);
  let title = '';
  let state = 'OPEN';
  let bodyStartIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    if (line === '--') {
      bodyStartIdx = i + 1;
      break;
    }
    const titleMatch = line.match(/^title:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    const stateMatch = line.match(/^state:\s*(.+)$/i);
    if (stateMatch) {
      state = stateMatch[1].trim().toUpperCase();
    }
  }

  if (!title) {
    const h1 = lines.find((l) => /^#\s+\S+/.test(l));
    if (h1) {
      title = h1.replace(/^#\s+/, '').trim();
    }
  }

  const body = lines.slice(bodyStartIdx).join('\n').trim();
  return { title, state, body };
}

function extractLeadingBracketTokens(title = '') {
  const tokens = [];
  let rest = String(title ?? '').trim();
  const bracketRe = /^\[([^\]]+)\]\s*/;
  let match = rest.match(bracketRe);
  while (match) {
    const rawInside = match[1].trim();
    const parts = rawInside
      .split(/[\/／,、|+\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    tokens.push(...parts);
    rest = rest.slice(match[0].length);
    match = rest.match(bracketRe);
  }
  return tokens;
}

export function classifyTicketScopeDeterministic({
  title = '',
  body = '',
  state = 'OPEN',
} = {}) {
  const normalizedState = String(state ?? 'OPEN')
    .trim()
    .toUpperCase();

  if (normalizedState === 'CLOSED') {
    return {
      decided: true,
      scope: 'non_frontend',
      actionableInFrontendRepo: false,
      frontendTasksSummary: '',
      outOfRepoItems: [],
      reason: '此 Ticket 狀態已關閉（CLOSED），前端虛擬機自動略過。',
    };
  }

  const tokens = extractLeadingBracketTokens(title);

  if (tokens.includes('epic')) {
    return {
      decided: true,
      scope: 'non_frontend',
      actionableInFrontendRepo: false,
      frontendTasksSummary: '',
      outOfRepoItems: [],
      reason: '此票為系列母票（Epic），請針對具體子票觸發雲端實作。',
    };
  }

  if (tokens.some((t) => EPIC_OR_RESEARCH_TAGS.has(t))) {
    return {
      decided: true,
      scope: 'non_frontend',
      actionableInFrontendRepo: false,
      frontendTasksSummary: '',
      outOfRepoItems: [],
      reason: '此票為架構調研／提案票（Spike / 提案），非前端程式碼實作範圍。',
    };
  }

  const hasFeMarker = tokens.some((t) => FRONTEND_ROLE_MARKERS.has(t));
  const hasNonFeMarker = tokens.some((t) => NON_FRONTEND_ROLE_MARKERS.has(t));

  if (hasNonFeMarker && !hasFeMarker) {
    return {
      decided: true,
      scope: 'non_frontend',
      actionableInFrontendRepo: false,
      frontendTasksSummary: '',
      outOfRepoItems: [],
      reason: `此票標題明確標示為非前端領域（${title.match(/^(\[[^\]]+\]\s*)+/)?.[0]?.trim() || '不含 FE'}），前端虛擬機自動略過。`,
    };
  }

  return {
    decided: false,
    scope: 'frontend_only',
    actionableInFrontendRepo: true,
    frontendTasksSummary: '',
    outOfRepoItems: [],
    reason: '',
    bodyLength: body.length,
  };
}

function buildScopeClassifierPrompt({ title, body }) {
  return [
    '你是 X-Talent 專案的雲端虛擬機入口分流器（Scope Gatekeeper）。',
    '目前這個 GitHub Actions 虛擬機**只能修改前端儲存庫 `X-Talent-Frontend`（Next.js App Router、React 元件、前端路由導頁與 query 參數處理、登入 callbackUrl 導回、站內通知文案映射 notificationMapper、API 串接、GA4 gtag 前端埋點、Storybook、Vitest 與 Playwright 測試）**。',
    '後端 API 開發、資料庫儲存、資料離開後端前的遮罩運算、排程 Cron Job、發送 Email、GA4/GCP 後台設定則屬於 `X-Talent-Backend` 或外部系統。',
    '',
    '請根據以下 Ticket 標題與內容，判斷本票在 `X-Talent-Frontend` 是否有可執行的前端實作工作：',
    '- 若整張票**完全屬於後端、純業務規則定義（前端入口已拆在其他子票）、外部後台設定或 PM 文件規劃**，沒有任何獨立的前端程式碼需要修改，請回傳 `"scope": "non_frontend"` 且 `"actionableInFrontendRepo": false`。',
    '- 若本票同時包含後端工作（如寄送 Email、排程發通知、DB 邏輯）與前端工作（如點擊通知或信中連結導向前端路由並開啟彈窗、未登入導回），請回傳 `"scope": "mixed_fe_be"` 且 `"actionableInFrontendRepo": true`，並清楚拆分 `frontendTasksSummary` 與 `outOfRepoItems`。',
    '- 若本票純屬前端工作，請回傳 `"scope": "frontend_only"` 且 `"actionableInFrontendRepo": true`。',
    '',
    `## Ticket 標題\n${title}`,
    '',
    `## Ticket 內容與留言節錄\n${String(body ?? '').slice(0, 14000)}`,
    '',
    '請只回傳以下 JSON 格式：',
    '{',
    '  "scope": "frontend_only | mixed_fe_be | non_frontend",',
    '  "actionableInFrontendRepo": boolean,',
    '  "frontendTasksSummary": "繁體中文簡述前端儲存庫應實作的具體項目（無則填空字串）",',
    '  "outOfRepoItems": ["繁體中文列出屬於後端或外部系統、不應在前端實作或阻擋前端 PR 收斂的項目"],',
    '  "reason": "一句話繁體中文判斷理由"',
    '}',
  ].join('\n');
}

function sanitizeSingleLine(value) {
  return String(value ?? '')
    .replace(/[\r\n`$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function evaluateTicketScope(
  ticket = {},
  { branchName = '', callClassifier } = {}
) {
  const cleanBranch = String(branchName ?? '').trim();
  if (cleanBranch) {
    return {
      scope: 'frontend_only',
      actionableInFrontendRepo: true,
      frontendTasksSummary: '',
      outOfRepoItems: [],
      reason: `已指定既有推廣分支 ${sanitizeSingleLine(cleanBranch)}，直接放行進入實作與收斂流程。`,
    };
  }

  const det = classifyTicketScopeDeterministic(ticket);
  if (det.decided) {
    return {
      scope: det.scope,
      actionableInFrontendRepo: det.actionableInFrontendRepo,
      frontendTasksSummary: det.frontendTasksSummary,
      outOfRepoItems: det.outOfRepoItems,
      reason: sanitizeSingleLine(det.reason),
    };
  }

  if (
    !String(ticket?.title ?? '').trim() &&
    !String(ticket?.body ?? '').trim()
  ) {
    return {
      scope: 'frontend_only',
      actionableInFrontendRepo: true,
      frontendTasksSummary: '',
      outOfRepoItems: [],
      reason: '預檢階段未讀到規格內容，預設放行交由後續階段重試讀取。',
    };
  }

  if (typeof callClassifier === 'function') {
    try {
      const llmRes = await callClassifier(ticket);
      if (llmRes && typeof llmRes.actionableInFrontendRepo === 'boolean') {
        const validScope = [
          'frontend_only',
          'mixed_fe_be',
          'non_frontend',
        ].includes(llmRes.scope)
          ? llmRes.scope
          : llmRes.actionableInFrontendRepo
            ? 'frontend_only'
            : 'non_frontend';
        return {
          scope: validScope,
          actionableInFrontendRepo: llmRes.actionableInFrontendRepo,
          frontendTasksSummary: sanitizeSingleLine(llmRes.frontendTasksSummary),
          outOfRepoItems: Array.isArray(llmRes.outOfRepoItems)
            ? llmRes.outOfRepoItems
                .map((x) => sanitizeSingleLine(x))
                .filter(Boolean)
            : [],
          reason: sanitizeSingleLine(llmRes.reason),
        };
      }
    } catch (err) {
      console.warn(
        `[check-ticket-scope] Classifier call failed (${err.message}); defaulting to actionable=true.`
      );
    }
  }

  return {
    scope: 'frontend_only',
    actionableInFrontendRepo: true,
    frontendTasksSummary: '',
    outOfRepoItems: [],
    reason: '通過前端預檢，進入實作流程。',
  };
}

export function buildScopedImplementationGuidance(scopeResult) {
  if (!scopeResult || !scopeResult.actionableInFrontendRepo) {
    return '';
  }
  const hasOutItems =
    Array.isArray(scopeResult.outOfRepoItems) &&
    scopeResult.outOfRepoItems.length > 0;
  if (scopeResult.scope !== 'mixed_fe_be' && !hasOutItems) {
    return '';
  }

  const lines = [
    '',
    '【跨前後端混合票實作邊界防護】',
    '本票為跨前後端／跨系統混合票，請嚴格只實作屬於 `X-Talent-Frontend` 前端儲存庫的範圍：',
  ];

  if (scopeResult.frontendTasksSummary) {
    lines.push(`- 前端應實作範圍：${scopeResult.frontendTasksSummary}`);
  }
  if (hasOutItems) {
    lines.push(
      '- 以下項目屬於後端（`X-Talent-Backend`）或外部系統職責，請勿在前端偽造後端排程／寄信邏輯，也切勿因此卡住：'
    );
    for (const item of scopeResult.outOfRepoItems) {
      lines.push(`  * [非前端豁免] ${item}`);
    }
  }

  return lines.join('\n');
}

function parseCliOption(argv, prefix) {
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : '';
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);
  const specFile =
    parseCliOption(argv, '--spec-file=') || '.agents/tmp/ticket-spec.md';
  const branchName =
    parseCliOption(argv, '--branch=') || process.env.BRANCH_NAME || '';
  const outFile = parseCliOption(argv, '--out=');
  const guidanceOutFile = parseCliOption(argv, '--guidance-out=');

  const rawSpec = fs.existsSync(specFile)
    ? fs.readFileSync(specFile, 'utf8')
    : '';

  const parsedTicket = parseIssueSpecMarkdown(rawSpec);

  const defaultClassifier = process.env.GEMINI_API_KEY
    ? async (t) =>
        callGemini(buildScopeClassifierPrompt(t), {
          model: process.env.GEMINI_MODEL || 'gemini-4-carbon',
          maxOutputTokens: 4096,
        })
    : undefined;

  evaluateTicketScope(parsedTicket, {
    branchName,
    callClassifier: defaultClassifier,
  })
    .then((result) => {
      if (outFile) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
      }
      if (guidanceOutFile) {
        fs.mkdirSync(path.dirname(guidanceOutFile), { recursive: true });
        fs.writeFileSync(
          guidanceOutFile,
          buildScopedImplementationGuidance(result),
          'utf8'
        );
      }
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[check-ticket-scope] Unexpected error:', err);
      const fallback = {
        scope: 'frontend_only',
        actionableInFrontendRepo: true,
        frontendTasksSummary: '',
        outOfRepoItems: [],
        reason: 'Fallback on unexpected error',
      };
      console.log(JSON.stringify(fallback, null, 2));
      process.exit(0);
    });
}
