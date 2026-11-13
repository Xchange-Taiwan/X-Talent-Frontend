#!/usr/bin/env node
/**
 * Cloud Pre-PR Multi-Round AI Reviewer + Playwright E2E Convergence Loop
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REVIEW_CATEGORIES = [
  'security',
  'correctness',
  'businessLogic',
  'visualParity',
  'performance',
  'testing',
  'architecture',
];

const MOCK_PROJECT_DIRS = [
  'e2e/tests/public/',
  'e2e/tests/profile/',
  'e2e/tests/reservation/',
  'e2e/tests/notification/',
];

const MOCK_PROJECT_IGNORED = new Set([
  'e2e/tests/profile/profile-view.spec.ts',
  'e2e/tests/profile/schedule-sync.spec.ts',
  'e2e/tests/reservation/reservation-create.spec.ts',
  'e2e/tests/reservation/reservation-booking-then-return.spec.ts',
]);

export function clampMaxRounds(rawValue, fallback = 20) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 20);
}

export function parseConvergeArgs(argv = [], env = process.env) {
  const getArg = (prefix) => {
    const match = argv.find((item) => item.startsWith(prefix));
    return match ? match.slice(prefix.length).trim() : undefined;
  };

  const rawMaxRounds = getArg('--max-rounds=') ?? env.MAX_AI_REVIEW_ROUNDS;
  const maxRounds = clampMaxRounds(rawMaxRounds, 20);

  const rawTicket = (getArg('--ticket=') ?? env.TICKET_NUMBER ?? '')
    .replace(/^#/, '')
    .trim();
  const ticketNumber = /^\d+$/.test(rawTicket) ? rawTicket : '';

  const rawRunE2e = (getArg('--run-e2e=') ?? env.RUN_E2E ?? 'true')
    .toLowerCase()
    .trim();
  const runE2e = rawRunE2e !== 'false' && rawRunE2e !== '0';

  const rawRunAiReview = (
    getArg('--run-ai-review=') ??
    env.RUN_PRE_PR_AI_REVIEW ??
    'true'
  )
    .toLowerCase()
    .trim();
  const runAiReview = rawRunAiReview !== 'false' && rawRunAiReview !== '0';

  const rawRequireEvidence = (
    getArg('--require-ui-evidence=') ??
    env.REQUIRE_UI_EVIDENCE ??
    'false'
  )
    .toLowerCase()
    .trim();
  const requireUiEvidence =
    rawRequireEvidence === 'true' || rawRequireEvidence === '1';

  const baseRef = getArg('--base-ref=') || env.BASE_REF || 'origin/develop';
  const summaryOut =
    getArg('--summary-out=') ||
    env.CONVERGE_SUMMARY_OUT ||
    '.agents/tmp/cloud-converge-summary.md';
  const geminiModel = env.GEMINI_MODEL || 'gemini-4-carbon';

  return {
    maxRounds,
    ticketNumber,
    runE2e,
    runAiReview,
    requireUiEvidence,
    baseRef,
    summaryOut,
    geminiModel,
  };
}

/**
 * Extracts a JSON object from stdout even when preceded by dotenv or CLI
 * banners (e.g. `[dotenv@17.x.x] injecting env ...`).
 */
export function extractJsonObject(rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const start = text.indexOf('{', searchFrom);
      if (start === -1) break;
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (ch === '\\') {
          escapeNext = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === '{') {
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            const candidate = text.slice(start, i + 1);
            try {
              return JSON.parse(candidate);
            } catch {
              break;
            }
          }
        }
      }
      searchFrom = start + 1;
    }
    return null;
  }
}

/**
 * Identifies modified/added Playwright spec files from `git diff --name-only`
 * and separates mock-lane specs, backend-readonly specs, and onboarding specs
 * (excluding stateful real-backend canary specs unless explicitly enabled).
 */
export function detectChangedE2eSpecs(
  changedFiles = [],
  { includeCanary = false } = {}
) {
  const allChangedSpecs = [];
  const changedMockSpecs = [];
  const changedReadonlySpecs = [];
  const extraNonMockSpecs = [];
  let hasAppCodeChanges = false;
  let hasUiSurfaceChanges = false;
  let hasSharedE2eChanges = false;

  for (const rawFile of changedFiles) {
    const normalized = String(rawFile ?? '')
      .replace(/\\/g, '/')
      .trim();
    if (!normalized) {
      continue;
    }
    const isUnitOrStoryFile =
      normalized.endsWith('.test.ts') ||
      normalized.endsWith('.test.tsx') ||
      normalized.endsWith('.stories.ts') ||
      normalized.endsWith('.stories.tsx');

    if (
      !isUnitOrStoryFile &&
      (normalized.startsWith('src/app/') ||
        normalized.startsWith('src/components/') ||
        normalized.startsWith('src/styles/')) &&
      (normalized.endsWith('.tsx') || normalized.endsWith('.css')) &&
      !normalized.startsWith('src/app/api/')
    ) {
      hasUiSurfaceChanges = true;
    }

    if (
      normalized === 'playwright.config.ts' ||
      (normalized.startsWith('e2e/') && !normalized.endsWith('.spec.ts'))
    ) {
      hasSharedE2eChanges = true;
      hasAppCodeChanges = true;
    } else if (
      (normalized.startsWith('src/') && !isUnitOrStoryFile) ||
      normalized === 'middleware.ts' ||
      normalized === 'next.config.js' ||
      normalized === 'tailwind.config.js' ||
      normalized === 'package.json'
    ) {
      hasAppCodeChanges = true;
    }
    if (
      !normalized.startsWith('e2e/tests/') ||
      !normalized.endsWith('.spec.ts')
    ) {
      continue;
    }
    if (!includeCanary && normalized.startsWith('e2e/tests/canary/')) {
      continue;
    }
    allChangedSpecs.push(normalized);

    if (MOCK_PROJECT_IGNORED.has(normalized)) {
      changedReadonlySpecs.push(normalized);
      continue;
    }

    const inMockDir = MOCK_PROJECT_DIRS.some((dir) =>
      normalized.startsWith(dir)
    );
    if (inMockDir) {
      changedMockSpecs.push(normalized);
    } else if (normalized.startsWith('e2e/tests/onboarding/')) {
      extraNonMockSpecs.push(normalized);
    }
  }

  return {
    allChangedSpecs,
    changedMockSpecs,
    changedReadonlySpecs,
    extraNonMockSpecs,
    hasAppCodeChanges,
    hasUiSurfaceChanges,
    hasSharedE2eChanges,
  };
}

const FRONTEND_CRITERION_KEYWORDS =
  /(點擊|點選|打開|開啟|展開|彈窗|視窗|modal|dialog|popover|頁面|畫面|導向|導回|導頁|路由|卡片|按鈕|列表|顯示|隱藏|欄位|滑桿|表單|tab|分頁|登入後|未登入|前端|瀏覽器|元件|storybook|gtag|page_view|scroll_depth|dataLayer|樣式|版面|rwd|手機版|桌機)/i;

const PURE_BACKEND_OR_EXTERNAL_CRITERION_PATTERNS = [
  /收到站內通知與\s*email/i,
  /(?:收到|寄送|發送).*(?:通知信|email|信件)/i,
  /不會再通知/,
  /同一場只會收到一次/,
  /不會重複發送/,
  /通知發送失敗時[，,].*仍正常儲存/,
  /資料離開系統前完成/,
  /BigQuery\s*每日自動匯出/i,
  /GA4\s*後台.*註冊/i,
];

/**
 * Determines whether a requirementCoverage entry applies to `X-Talent-Frontend`.
 * Exempts criteria explicitly tagged `scope: "out_of_repo" | "backend" | "external"`
 * (or `applicableToFrontend: false`), as well as pure backend email/cron/DB
 * delivery criteria that contain zero frontend UI/routing responsibilities.
 */
export function isFrontendApplicableCriterion(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const scope = String(item.scope ?? '')
    .toLowerCase()
    .trim();
  if (
    scope === 'out_of_repo' ||
    scope === 'backend' ||
    scope === 'external' ||
    item.applicableToFrontend === false
  ) {
    return false;
  }

  const text = String(item.criterion ?? '').trim();
  if (!text) {
    return false;
  }

  if (FRONTEND_CRITERION_KEYWORDS.test(text)) {
    return true;
  }

  if (PURE_BACKEND_OR_EXTERNAL_CRITERION_PATTERNS.some((re) => re.test(text))) {
    return false;
  }

  return true;
}

export function normalizeErrorSignatures(errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) return [];
  return errors
    .map((raw) => {
      const cleaned = String(raw ?? '')
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s)\b/g, '<time>')
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<ts>');
      const lines = cleaned
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 0 &&
            (l.startsWith('[') ||
              /(error|fail|expected|unable to find|ts\d{4}|typeerror|assertionerror|referenceerror|syntaxerror)/i.test(
                l
              ) ||
              /\.(?:ts|tsx|js|jsx|mjs):\d+/.test(l))
        )
        .slice(0, 12);
      const summary = (lines.length > 0 ? lines.join(' ;; ') : cleaned.trim())
        .replace(/\s+/g, ' ')
        .slice(0, 500);
      return summary;
    })
    .filter(Boolean)
    .sort();
}

export function ensurePhase2GeminiToolExclusions(
  settingsPath = '.gemini/settings.json',
  fsImpl = fs
) {
  if (!fsImpl.existsSync(settingsPath)) return false;
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(settingsPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false;
    }
    const nextConfig = { ...parsed };
    delete nextConfig.mcpServers;
    delete nextConfig.hooks;

    const existing = Array.isArray(nextConfig?.tools?.exclude)
      ? nextConfig.tools.exclude
      : [];
    const mergedExclude = [
      ...new Set([
        ...existing,
        'run_shell_command',
        'web_fetch',
        'google_web_search',
      ]),
    ];

    const prevFiltering =
      nextConfig.fileFiltering && typeof nextConfig.fileFiltering === 'object'
        ? nextConfig.fileFiltering
        : {};
    const prevContext =
      nextConfig.context && typeof nextConfig.context === 'object'
        ? nextConfig.context
        : {};
    const prevCtxFiltering =
      prevContext.fileFiltering && typeof prevContext.fileFiltering === 'object'
        ? prevContext.fileFiltering
        : {};

    const updated = {
      ...nextConfig,
      tools: {
        ...(nextConfig.tools && typeof nextConfig.tools === 'object'
          ? nextConfig.tools
          : {}),
        exclude: mergedExclude,
      },
      fileFiltering: {
        ...prevFiltering,
        // Keep respectGitIgnore: true so Gemini CLI never scans node_modules/
        // or .next/ (~200k files). `.agents/tmp/` is removed from `.gitignore`
        // in-memory during cloud runs so `.agents/tmp/ticket-spec.md` stays readable.
        respectGitIgnore: true,
        respectGeminiIgnore: false,
      },
      context: {
        ...prevContext,
        fileFiltering: {
          ...prevCtxFiltering,
          respectGitIgnore: true,
          respectGeminiIgnore: false,
        },
      },
    };
    fsImpl.writeFileSync(
      settingsPath,
      `${JSON.stringify(updated, null, 2)}\n`,
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
}

export function applyPhase2HeadlessWorkspaceLocks({
  cwd = process.cwd(),
  fsImpl = fs,
  execGit = execFileSync,
} = {}) {
  const gitignorePath = path.join(cwd, '.gitignore');
  if (fsImpl.existsSync(gitignorePath)) {
    try {
      const giRaw = fsImpl.readFileSync(gitignorePath, 'utf8');
      const giFiltered = giRaw
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '/.agents/tmp/')
        .join('\n');
      if (giFiltered !== giRaw) {
        fsImpl.writeFileSync(gitignorePath, giFiltered, 'utf8');
      }
      execGit('git', ['update-index', '--skip-worktree', '.gitignore'], {
        cwd,
        stdio: 'ignore',
      });
    } catch {}
  }

  const settingsPath = path.join(cwd, '.gemini', 'settings.json');
  if (ensurePhase2GeminiToolExclusions(settingsPath, fsImpl)) {
    try {
      execGit(
        'git',
        ['update-index', '--skip-worktree', '.gemini/settings.json'],
        {
          cwd,
          stdio: 'ignore',
        }
      );
    } catch {}
  }
}

export function createSnapshotSaver({
  cwd = process.cwd(),
  fsImpl = fs,
  execGit = execFileSync,
} = {}) {
  return () => {
    const tmpIdx = path.join(
      process.env.RUNNER_TEMP || os.tmpdir(),
      `converge-idx-${process.pid}-${Date.now()}`
    );
    try {
      const snapEnv = { ...process.env, GIT_INDEX_FILE: tmpIdx };
      execGit('git', ['read-tree', 'HEAD'], {
        cwd,
        env: snapEnv,
        stdio: 'ignore',
      });
      execGit('git', ['add', '-A'], { cwd, env: snapEnv, stdio: 'ignore' });
      try {
        const cachedNames = execGit(
          'git',
          ['diff', '--cached', '--name-only'],
          {
            cwd,
            env: snapEnv,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          }
        )
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const f of cachedNames) {
          if (
            /(^|\/)\.env(\..+)?$/.test(f) &&
            !/\.env\.(example|sample|template)$/.test(f)
          ) {
            try {
              execGit('git', ['reset', '--', f], {
                cwd,
                env: snapEnv,
                stdio: 'ignore',
              });
            } catch {}
          }
        }
      } catch {}
      for (const spec of ['.agents/tmp*', '.gitignore', '.gemini/settings.json']) {
        try {
          execGit('git', ['reset', '--', spec], {
            cwd,
            env: snapEnv,
            stdio: 'ignore',
          });
        } catch {}
      }
      const treeSha = execGit('git', ['write-tree'], {
        cwd,
        env: snapEnv,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return treeSha;
    } catch {
      return '';
    } finally {
      try {
        fsImpl.rmSync(tmpIdx, { force: true });
      } catch {}
    }
  };
}

export function createSnapshotRestorer({
  cwd = process.cwd(),
  fsImpl = fs,
  execGit = execFileSync,
} = {}) {
  return (treeSha) => {
    if (!treeSha) return;
    try {
      execGit('git', ['read-tree', '--reset', '-u', treeSha], {
        cwd,
        stdio: 'ignore',
      });
      execGit('git', ['checkout-index', '-f', '-a'], {
        cwd,
        stdio: 'ignore',
      });
      execGit(
        'git',
        [
          'clean',
          '-fd',
          '-e',
          '.env*',
          '-e',
          '.agents/tmp',
          '-e',
          '.agents/tmp/**',
        ],
        { cwd, stdio: 'ignore' }
      );
      applyPhase2HeadlessWorkspaceLocks({ cwd, fsImpl, execGit });
    } catch {
      // Ignore best-effort rollback errors
    }
  };
}

/**
 * Evaluates whether the current round has fully converged and produces a
 * deterministic fingerprint for stall/oscillation detection.
 */
export function evaluateRoundConvergence({
  deterministicPassed,
  e2ePassed,
  deterministicErrors = [],
  e2eErrors = [],
  reviewResult,
}) {
  const findingsByCategory = {};
  const flatFindings = [];

  for (const category of REVIEW_CATEGORIES) {
    const items = Array.isArray(reviewResult?.findings?.[category])
      ? reviewResult.findings[category]
      : [];
    findingsByCategory[category] = items;
    for (const item of items) {
      flatFindings.push({
        category,
        file: item?.file ?? 'unknown',
        line: item?.line ?? null,
        issue: item?.issue ?? '',
        why: item?.why ?? '',
        fix: item?.fix ?? '',
      });
    }
  }

  const requirementCoverage = Array.isArray(reviewResult?.requirementCoverage)
    ? reviewResult.requirementCoverage
    : [];
  const exemptedCriteria = requirementCoverage.filter(
    (item) => item && !isFrontendApplicableCriterion(item)
  );
  const uncoveredCriteria = requirementCoverage.filter(
    (item) =>
      item && item.covered === false && isFrontendApplicableCriterion(item)
  );

  const riskLevel = String(reviewResult?.overallRisk?.level ?? 'low')
    .toLowerCase()
    .trim();
  const riskReason = reviewResult?.overallRisk?.reason ?? '';

  const converged =
    Boolean(deterministicPassed) &&
    Boolean(e2ePassed) &&
    riskLevel === 'low' &&
    uncoveredCriteria.length === 0;

  const detSignatures = normalizeErrorSignatures(deterministicErrors);
  const e2eSignatures = normalizeErrorSignatures(e2eErrors);

  const fingerprintParts = [
    `det:${Boolean(deterministicPassed)}`,
    `e2e:${Boolean(e2ePassed)}`,
    `risk:${riskLevel}`,
    ...detSignatures.map((sig) => `detErr:${sig}`),
    ...e2eSignatures.map((sig) => `e2eErr:${sig}`),
    ...flatFindings
      .map((f) => `${f.category}:${f.file}:${f.line ?? ''}:${f.issue.trim()}`)
      .sort(),
    ...uncoveredCriteria
      .map((c) => `ac:${String(c.criterion ?? '').trim()}`)
      .sort(),
  ];

  return {
    converged,
    riskLevel,
    riskReason,
    totalFindings: flatFindings.length,
    flatFindings,
    findingsByCategory,
    uncoveredCriteria,
    exemptedCriteria,
    fingerprint: fingerprintParts.join('|'),
  };
}

const MAX_FINDINGS_PER_ROUND = 4;

export function buildRoundFixPrompt({
  round,
  maxRounds,
  ticketNumber,
  deterministicErrors = [],
  e2eErrors = [],
  evaluation,
}) {
  const sections = [
    `你正在執行雲端 Pre-PR 自動收斂迴圈（第 ${round}/${maxRounds} 輪）${ticketNumber ? `，對應 Ticket #${ticketNumber}` : ''}。`,
    '請直接使用檔案讀寫工具（`read_file` / `replace` / `write_file`）修改工作目錄中的程式碼或測試檔案以修復以下問題（嚴禁修改 `.env*` 或 `.agents/tmp*`）：',
  ];

  if (deterministicErrors.length > 0) {
    sections.push(
      `### 1. 靜態檢查 / 單元測試失敗 (Lint / Type-check / Vitest)\n\`\`\`\n${deterministicErrors.join('\n\n').slice(0, 5000)}\n\`\`\``
    );
  }

  if (e2eErrors.length > 0) {
    sections.push(
      `### 2. Playwright E2E 端對端測試失敗\n\`\`\`\n${e2eErrors.join('\n\n').slice(0, 5000)}\n\`\`\``
    );
  }

  if (evaluation?.uncoveredCriteria?.length > 0) {
    const acSlice = evaluation.uncoveredCriteria.slice(
      0,
      MAX_FINDINGS_PER_ROUND
    );
    const acLines = acSlice.map(
      (item, idx) =>
        `${idx + 1}. 驗收條件未滿足：「${item.criterion}」— 原因：${item.note || '未實作或缺少驗證'}`
    );
    sections.push(
      `### 3. Ticket 驗收條件缺口 (本輪優先處理前 ${acSlice.length} 項)\n${acLines.join('\n')}`
    );
  }

  const remainingSlots = Math.max(
    1,
    MAX_FINDINGS_PER_ROUND - (evaluation?.uncoveredCriteria?.length ?? 0)
  );
  if (evaluation?.flatFindings?.length > 0) {
    const prioritized = evaluation.flatFindings.slice(0, remainingSlots);
    const findingLines = prioritized.map(
      (f, idx) =>
        `${idx + 1}. [${f.category}] ${f.file}${f.line ? `:${f.line}` : ''}\n   - 問題：${f.issue}\n   - 原因：${f.why}\n   - 建議修法：${f.fix}`
    );
    sections.push(
      `### 4. AI Review 審查發現 (Overall Risk: ${evaluation.riskLevel}，本輪聚焦前 ${prioritized.length}/${evaluation.flatFindings.length} 項)\n${findingLines.join('\n\n')}`
    );
  } else if (evaluation && evaluation.riskLevel !== 'low') {
    sections.push(
      `### 4. AI Review 整體風險評估為 ${evaluation.riskLevel}\n- 理由：${evaluation.riskReason}\n請針對上述風險原因補強錯誤處理、邊界防護或單元/E2E 測試。`
    );
  }

  sections.push(
    '極速收斂規則：檔案修改儲存完畢後請**立即結束回覆**！嚴禁在此步驟呼叫 `run_shell_command` 執行 `pnpm test`、`vitest`、`playwright`、`pnpm build`、`pnpm dev` 或 `git`，因為外層收斂迴圈會在你結束後 1 秒內自動執行平行 `lint`、`type-check`、`vitest related` 與 Turbopack E2E 驗證。'
  );

  return sections.join('\n\n');
}

export function formatConvergenceSummaryMarkdown({
  converged,
  stalled,
  roundsRun,
  maxRounds,
  runE2e,
  e2ePassed,
  changedSpecs = [],
  evaluation,
}) {
  const statusText = converged
    ? '已完全收斂通過 (Converged)'
    : stalled
      ? '達到相同問題連續重現上限，已提前結束迴圈 (Stall Guard)'
      : '達到最大輪數上限 (Max Rounds Reached)';

  const e2eText = !runE2e
    ? '略過 (--run-e2e=false)'
    : e2ePassed
      ? `通過 (pnpm test:e2e:mock${changedSpecs.length > 0 ? ` + ${changedSpecs.length} 個變更 Spec` : ''})`
      : '未完全通過';

  const exemptedNote =
    evaluation?.exemptedCriteria?.length > 0
      ? `；已自動豁免 ${evaluation.exemptedCriteria.length} 項後端／外部系統 AC`
      : '';

  const lines = [
    '## Cloud Pre-PR AI Review & E2E Convergence Summary',
    '',
    `- **收斂狀態**：${statusText}`,
    `- **執行輪數**：${roundsRun} / ${maxRounds} 輪`,
    `- **AI Review 最終風險**：\`${evaluation?.riskLevel ?? 'low'}\`（剩餘 Findings：${evaluation?.totalFindings ?? 0} 筆${exemptedNote}）`,
    `- **Playwright E2E 驗證**：${e2eText}`,
  ];

  if (evaluation?.flatFindings?.length > 0) {
    lines.push('', '### 剩餘待留意項目');
    for (const f of evaluation.flatFindings) {
      lines.push(
        `- **[${f.category}] \`${f.file}${f.line ? `:${f.line}` : ''}\`**：${f.issue}`
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

const STEP_TIMEOUT_MS = {
  static: 3 * 60 * 1000,
  unitTest: 8 * 60 * 1000,
  e2e: 10 * 60 * 1000,
  review: 5 * 60 * 1000,
  geminiFix: 5 * 60 * 1000,
};

export function inferDefaultTimeoutMs(cmd, args = []) {
  const first = String(args[0] ?? '');
  if (cmd === 'pnpm' && (first === 'lint' || first === 'type-check')) {
    return STEP_TIMEOUT_MS.static;
  }
  if (
    (cmd === 'pnpm' && first === 'test') ||
    (cmd === 'npx' && first === 'vitest')
  ) {
    return STEP_TIMEOUT_MS.unitTest;
  }
  if (cmd === 'pnpm' && (first === 'test:e2e:mock' || first === 'playwright')) {
    return STEP_TIMEOUT_MS.e2e;
  }
  if (cmd === 'node' && first.includes('run-local.mjs')) {
    return STEP_TIMEOUT_MS.review;
  }
  return STEP_TIMEOUT_MS.geminiFix;
}

function defaultExecStep(cmd, args, options = {}) {
  const isWin = process.platform === 'win32';
  const resolvedCmd =
    isWin && (cmd === 'pnpm' || cmd === 'npx') ? `${cmd}.cmd` : cmd;
  const timeout = options.timeout ?? inferDefaultTimeoutMs(cmd, args);
  try {
    const stdout = execFileSync(resolvedCmd, args, {
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024,
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    return { ok: true, timedOut: false, stdout, stderr: '' };
  } catch (err) {
    const timedOut = err?.code === 'ETIMEDOUT' || err?.signal === 'SIGTERM';
    const stdout = String(err.stdout ?? '');
    const rawStderr = String(err.stderr ?? '').trim();
    const stderr =
      [rawStderr, timedOut ? `Command timed out after ${timeout}ms` : '']
        .filter(Boolean)
        .join('\n') || String(err.message ?? '');
    return {
      ok: false,
      timedOut,
      stdout,
      stderr,
      combined: `${stdout}\n${stderr}`.trim(),
    };
  }
}

export async function runConvergeLoop(rawOptions = {}, deps = {}) {
  const execStep = deps.execStep || defaultExecStep;
  const writeFile =
    deps.writeFile ||
    ((filePath, content) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    });
  const log = deps.log || ((msg) => console.log(msg));
  const evidenceDir = rawOptions.evidenceDir || '.agents/tmp/evidence';
  const clearEvidence =
    deps.clearEvidence ||
    (() => {
      if (fs.existsSync(evidenceDir)) {
        for (const f of fs.readdirSync(evidenceDir)) {
          if (/\.(png|jpe?g|webp)$/i.test(f)) {
            fs.rmSync(path.join(evidenceDir, f), { force: true });
          }
        }
      }
    });
  const listEvidence =
    deps.listEvidence ||
    (() => {
      if (!fs.existsSync(evidenceDir)) return [];
      return fs
        .readdirSync(evidenceDir)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    });

  const fileExists = deps.fileExists || ((p) => fs.existsSync(p));

  const saveSnapshot = deps.saveSnapshot || createSnapshotSaver();

  const restoreSnapshot = deps.restoreSnapshot || createSnapshotRestorer();

  const config = {
    maxRounds: clampMaxRounds(rawOptions.maxRounds, 20),
    ticketNumber: rawOptions.ticketNumber ?? '',
    runE2e: rawOptions.runE2e !== false,
    runAiReview: rawOptions.runAiReview !== false,
    requireUiEvidence: Boolean(rawOptions.requireUiEvidence),
    baseRef: rawOptions.baseRef || 'origin/develop',
    summaryOut:
      rawOptions.summaryOut || '.agents/tmp/cloud-converge-summary.md',
    geminiModel: rawOptions.geminiModel || 'gemini-4-carbon',
  };

  const now = deps.now || (() => Date.now());
  const envBudgetMs = Number.parseInt(
    String(process.env.CONVERGE_MAX_DURATION_MS || ''),
    10
  );
  const maxDurationMs =
    typeof rawOptions.maxDurationMs === 'number' && rawOptions.maxDurationMs > 0
      ? rawOptions.maxDurationMs
      : Number.isFinite(envBudgetMs) && envBudgetMs > 0
        ? envBudgetMs
        : 72 * 60 * 1000;
  const loopStartMs = now();

  let previousFingerprint = '';
  let consecutiveSameFingerprint = 0;
  let timeoutResetsUsed = 0;
  let lastEvaluation = null;
  let lastE2ePassed = true;
  let lastChangedSpecs = [];
  let roundsRun = 0;
  let stalled = false;
  let bestSnapshotSha = '';
  let bestRoundScore = -Infinity;

  const collectChangedFiles = () => {
    const diffFilesRes = execStep('git', [
      'diff',
      '--name-only',
      config.baseRef,
    ]);
    const untrackedFilesRes = execStep('git', [
      'ls-files',
      '--others',
      '--exclude-standard',
    ]);
    const trackedDiffFiles = diffFilesRes.ok
      ? diffFilesRes.stdout.split(/\r?\n/).filter(Boolean)
      : [];
    const untrackedDiffFiles = untrackedFilesRes.ok
      ? untrackedFilesRes.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(
            (relPath) =>
              relPath &&
              !(
                /(^|\/)\.env(\..+)?$/.test(relPath) &&
                !/\.env\.(example|sample|template)$/.test(relPath)
              ) &&
              relPath !== '.agents/tmp' &&
              !relPath.startsWith('.agents/tmp/')
          )
      : [];
    return [...new Set([...trackedDiffFiles, ...untrackedDiffFiles])];
  };

  const computeRoundScore = (detOk, e2eOk, evalObj) =>
    (detOk ? 1000 : 0) +
    (e2eOk ? 500 : 0) -
    (evalObj?.uncoveredCriteria?.length ?? 0) * 10 -
    (evalObj?.totalFindings ?? 0);

  for (let round = 1; round <= config.maxRounds; round++) {
    roundsRun = round;
    log(
      `\n[cloud-converge] === Round ${round}/${config.maxRounds} starting ===`
    );

    const diffFiles = collectChangedFiles();

    const testEnv = {
      ...process.env,
      VITEST_MAX_WORKERS: process.env.VITEST_MAX_WORKERS || '3',
    };

    // 1. Deterministic checks: fast-fail on lint/type-check before running unit tests
    const deterministicErrors = [];
    for (const [label, args] of [
      ['pnpm lint', ['lint']],
      ['pnpm type-check', ['type-check']],
    ]) {
      const res = execStep('pnpm', args);
      if (!res.ok) {
        log(`[cloud-converge] ${label} failed in round ${round}`);
        deterministicErrors.push(`[${label}]\n${res.combined || res.stderr}`);
      }
    }

    let ranFullUnitSuiteThisRound = false;
    if (deterministicErrors.length === 0) {
      const relatedCandidates = diffFiles.filter(
        (f) =>
          /\.(ts|tsx|js|jsx|mjs)$/.test(f) &&
          !f.startsWith('e2e/') &&
          fileExists(f)
      );
      if (relatedCandidates.length > 0) {
        const relRes = execStep(
          'npx',
          [
            'vitest',
            'related',
            ...relatedCandidates,
            '--run',
            '--passWithNoTests',
          ],
          { env: testEnv }
        );
        if (!relRes.ok) {
          log(`[cloud-converge] vitest related failed in round ${round}`);
          deterministicErrors.push(
            `[vitest related]\n${relRes.combined || relRes.stderr}`
          );
        }
      } else {
        ranFullUnitSuiteThisRound = true;
        const testRes = execStep('pnpm', ['test'], { env: testEnv });
        if (!testRes.ok) {
          log(`[cloud-converge] pnpm test failed in round ${round}`);
          deterministicErrors.push(
            `[pnpm test]\n${testRes.combined || testRes.stderr}`
          );
        }
      }
    } else {
      log(
        `[cloud-converge] Static check failed in round ${round}; fast-failing to Gemini fix without running slow unit/E2E suites.`
      );
    }
    let deterministicPassed = deterministicErrors.length === 0;

    // 2. Playwright E2E verification (only when static + unit tests pass)
    const e2eErrors = [];
    let e2eReportForReviewer = '未執行 E2E (--run-e2e=false)';

    if (config.runE2e && !deterministicPassed) {
      lastE2ePassed = false;
    }

    if (config.runE2e && deterministicPassed) {
      const {
        allChangedSpecs,
        changedMockSpecs,
        changedReadonlySpecs,
        extraNonMockSpecs,
        hasAppCodeChanges,
        hasUiSurfaceChanges,
        hasSharedE2eChanges,
      } = detectChangedE2eSpecs(diffFiles);
      lastChangedSpecs = allChangedSpecs;

      if (config.requireUiEvidence && hasUiSurfaceChanges) {
        clearEvidence();
      }
      const useTargetedSpecs =
        !hasSharedE2eChanges && allChangedSpecs.length > 0;
      const e2eEnv = {
        ...process.env,
        CAPTURE_EVIDENCE: '1',
        EVIDENCE_OUT_DIR: evidenceDir,
        PLAYWRIGHT_USE_TURBO: '1',
        E2E_SKIP_FULL_WARMUP: useTargetedSpecs ? '1' : '0',
      };

      // When a ticket provides targeted E2E specs (and didn't touch shared
      // E2E helpers/config), run only those changed specs so we don't compile
      // all 14 unrelated routes on every round. If no E2E specs were modified
      // on a runtime app code change (or shared E2E helpers changed), fall back
      // to running the full mock suite. Pure unit-test / Storybook diffs skip E2E.
      const shouldRunFullMockSuite =
        hasSharedE2eChanges ||
        (hasAppCodeChanges && allChangedSpecs.length === 0) ||
        (diffFiles.length === 0 && !hasAppCodeChanges);

      if (shouldRunFullMockSuite || changedMockSpecs.length > 0) {
        const mockArgs =
          useTargetedSpecs && changedMockSpecs.length > 0
            ? [
                'test:e2e:mock',
                '--workers=4',
                '--retries=1',
                ...changedMockSpecs,
              ]
            : ['test:e2e:mock', '--workers=4', '--retries=1'];
        const mockE2eRes = execStep('pnpm', mockArgs, { env: e2eEnv });
        if (!mockE2eRes.ok) {
          log(`[cloud-converge] pnpm test:e2e:mock failed in round ${round}`);
          e2eErrors.push(
            `[pnpm test:e2e:mock]\n${mockE2eRes.combined || mockE2eRes.stderr}`
          );
        }
      }

      if (changedReadonlySpecs.length > 0) {
        const readonlyRes = execStep(
          'pnpm',
          [
            'playwright',
            'test',
            '--project=chromium-backend-readonly',
            '--retries=1',
            ...changedReadonlySpecs,
          ],
          { env: e2eEnv }
        );
        if (!readonlyRes.ok) {
          log(
            `[cloud-converge] backend-readonly E2E specs failed in round ${round}`
          );
          e2eErrors.push(
            `[playwright chromium-backend-readonly specs]\n${readonlyRes.combined || readonlyRes.stderr}`
          );
        }
      }

      if (extraNonMockSpecs.length > 0) {
        const extraRes = execStep(
          'pnpm',
          [
            'playwright',
            'test',
            '--project=chromium-onboarding',
            '--retries=1',
            ...extraNonMockSpecs,
          ],
          { env: e2eEnv }
        );
        if (!extraRes.ok) {
          log(`[cloud-converge] onboarding E2E specs failed in round ${round}`);
          e2eErrors.push(
            `[playwright onboarding specs]\n${extraRes.combined || extraRes.stderr}`
          );
        }
      }

      if (
        config.requireUiEvidence &&
        hasUiSurfaceChanges &&
        e2eErrors.length === 0
      ) {
        const capturedShots = listEvidence();
        if (capturedShots.length === 0) {
          log(
            `[cloud-converge] Missing interactive UI evidence screenshots in round ${round}`
          );
          e2eErrors.push(
            '[UI Evidence Gate] 本次變更修改了前端 UI 頁面或元件（src/app 或 src/components），但執行 E2E 後 `.agents/tmp/evidence/` 為空！請在對應的 Playwright E2E (`.spec.ts`) 測試中引入 `import { captureEvidence } from "../../helpers/evidence"`（依相對路徑調整），並在**實際互動點開本次修改的目標畫面狀態**（例如：點擊通知鈴鐺展開通知清單、切換至評價 Tab、打開彈窗 Dialog，並完成 `expect(...).toBeVisible()` 斷言）之後呼叫 `await captureEvidence(page, "<功能與狀態名稱>")`，切勿只截未展開的首頁！'
          );
        }
      }

      lastE2ePassed = e2eErrors.length === 0;
      const evidenceNote =
        config.requireUiEvidence && hasUiSurfaceChanges
          ? `（已擷取 ${listEvidence().length} 張互動 UI 證據截圖）`
          : '';
      e2eReportForReviewer = lastE2ePassed
        ? `Playwright E2E 測試已通過（已執行 E2E 驗證${allChangedSpecs.length > 0 ? `，涵蓋變更 Spec：${allChangedSpecs.join(', ')}` : ''}${evidenceNote}）。`
        : `Playwright E2E 測試失敗：\n${e2eErrors.join('\n').slice(0, 1500)}`;
    }

    // 3. Optional Pre-PR Gemini AI Review (disabled by default in Cloud VMs via --run-ai-review=false so PR CI acts as single referee)
    let reviewJson = {
      overallRisk: {
        level: 'low',
        reason: config.runAiReview
          ? 'Completed'
          : 'Skipped inside VM (--run-ai-review=false); delegated to PR CI AI Review Pipeline.',
      },
      requirementCoverage: [],
      findings: {},
    };

    if (!deterministicPassed) {
      reviewJson = {
        overallRisk: {
          level: 'medium',
          reason: 'Deferred until lint/type-check/unit tests pass.',
        },
        requirementCoverage: [],
        findings: {},
      };
    } else if (config.runAiReview) {
      const reviewArgs = [
        'scripts/ai-review/run-local.mjs',
        `--base-ref=${config.baseRef}`,
      ];
      if (config.ticketNumber) {
        reviewArgs.push(`--ticket=${config.ticketNumber}`);
      }

      const reviewRes = execStep('node', reviewArgs, {
        env: {
          ...process.env,
          TICKET_NUMBER: config.ticketNumber,
          E2E_VERIFICATION_REPORT: e2eReportForReviewer,
          GEMINI_MAX_OUTPUT_TOKENS: '32768',
          STRICT_AI_REVIEW: '1',
        },
      });

      if (reviewRes.ok && reviewRes.stdout.trim()) {
        const parsedJson = extractJsonObject(reviewRes.stdout);
        if (
          parsedJson &&
          !parsedJson.reviewError &&
          parsedJson.mode !== 'fallback-ci' &&
          parsedJson.mode !== 'fallback-in-context' &&
          parsedJson.mode !== 'review-error'
        ) {
          reviewJson = parsedJson;
        } else {
          log(
            `[cloud-converge] Warning: run-local.mjs returned fallback/error or unparseable JSON in round ${round}; failing closed.`
          );
          reviewJson = {
            overallRisk: {
              level: 'medium',
              reason:
                'Pre-PR AI Review failed or returned fallback-ci; retrying verification.',
            },
            requirementCoverage: [],
            findings: {},
          };
        }
      } else if (!reviewRes.ok) {
        log(
          `[cloud-converge] Warning: run-local.mjs exited non-zero in round ${round}; failing closed.`
        );
        reviewJson = {
          overallRisk: {
            level: 'medium',
            reason: 'Pre-PR AI Review process failed; retrying verification.',
          },
          requirementCoverage: [],
          findings: {},
        };
      }
    }

    lastEvaluation = evaluateRoundConvergence({
      deterministicPassed,
      e2ePassed: lastE2ePassed,
      deterministicErrors,
      e2eErrors,
      reviewResult: reviewJson,
    });

    log(
      `[cloud-converge] Round ${round} result: risk=${lastEvaluation.riskLevel}, findings=${lastEvaluation.totalFindings}, uncoveredAC=${lastEvaluation.uncoveredCriteria.length}, detPassed=${deterministicPassed}, e2ePassed=${lastE2ePassed}`
    );

    let currentRoundScore = computeRoundScore(
      deterministicPassed,
      lastE2ePassed,
      lastEvaluation
    );

    if (lastEvaluation.converged) {
      // If an intermediate fix round used fast `vitest related`, run one final
      // full `pnpm test` gate before declaring convergence so zero regressions slip through.
      if (!ranFullUnitSuiteThisRound) {
        log(
          `[cloud-converge] Running final full unit test gate before convergence exit...`
        );
        const finalUnitRes = execStep('pnpm', ['test'], { env: testEnv });
        if (!finalUnitRes.ok) {
          log(
            `[cloud-converge] Final full pnpm test gate failed in round ${round}; continuing fix loop.`
          );
          deterministicPassed = false;
          deterministicErrors.push(
            `[pnpm test]\n${finalUnitRes.combined || finalUnitRes.stderr}`
          );
          lastEvaluation = evaluateRoundConvergence({
            deterministicPassed: false,
            e2ePassed: lastE2ePassed,
            deterministicErrors,
            e2eErrors,
            reviewResult: reviewJson,
          });
          currentRoundScore = computeRoundScore(
            false,
            lastE2ePassed,
            lastEvaluation
          );
        }
      }
    }

    if (lastEvaluation.converged) {
      log(`[cloud-converge] Converged in round ${round}/${config.maxRounds}!`);
      const summaryMd = formatConvergenceSummaryMarkdown({
        converged: true,
        stalled: false,
        roundsRun: round,
        maxRounds: config.maxRounds,
        runE2e: config.runE2e,
        e2ePassed: lastE2ePassed,
        changedSpecs: lastChangedSpecs,
        evaluation: lastEvaluation,
      });
      writeFile(config.summaryOut, summaryMd);
      return {
        converged: true,
        stalled: false,
        roundsRun: round,
        evaluation: lastEvaluation,
        summaryMd,
      };
    }

    // Track best passing/cleanest tree snapshot so non-converged exits never push regressed code
    if (deterministicPassed && currentRoundScore >= bestRoundScore) {
      const candidateSha = saveSnapshot();
      if (candidateSha) {
        bestSnapshotSha = candidateSha;
        bestRoundScore = currentRoundScore;
      }
    }

    // Check oscillation / stall guard
    if (lastEvaluation.fingerprint === previousFingerprint) {
      consecutiveSameFingerprint += 1;
    } else {
      previousFingerprint = lastEvaluation.fingerprint;
      consecutiveSameFingerprint = 1;
    }

    const stallThreshold = !deterministicPassed || !lastE2ePassed ? 3 : 2;
    if (consecutiveSameFingerprint >= stallThreshold) {
      log(
        `[cloud-converge] Identical findings fingerprint repeated ${consecutiveSameFingerprint} times in round ${round}. Breaking loop via Stall Guard.`
      );
      stalled = true;
      if (bestSnapshotSha && currentRoundScore < bestRoundScore) {
        log(
          `[cloud-converge] Restoring best passing snapshot (${bestSnapshotSha.slice(0, 8)}) before exiting.`
        );
        restoreSnapshot(bestSnapshotSha);
      }
      break;
    }

    if (round >= config.maxRounds) {
      log(
        `[cloud-converge] Reached max rounds (${config.maxRounds}). Finishing loop.`
      );
      if (bestSnapshotSha && currentRoundScore < bestRoundScore) {
        log(
          `[cloud-converge] Restoring best passing snapshot (${bestSnapshotSha.slice(0, 8)}) before exiting.`
        );
        restoreSnapshot(bestSnapshotSha);
      }
      break;
    }

    if (now() - loopStartMs >= maxDurationMs) {
      log(
        `[cloud-converge] Soft wall-clock budget (${Math.round(maxDurationMs / 60000)}m) reached in round ${round}; exiting cleanly so Phase 3 can push and open PR.`
      );
      if (bestSnapshotSha && currentRoundScore < bestRoundScore) {
        log(
          `[cloud-converge] Restoring best passing snapshot (${bestSnapshotSha.slice(0, 8)}) before exiting.`
        );
        restoreSnapshot(bestSnapshotSha);
      }
      break;
    }

    // 4. Invoke Gemini CLI to self-heal all findings and test failures
    const fixPrompt = buildRoundFixPrompt({
      round,
      maxRounds: config.maxRounds,
      ticketNumber: config.ticketNumber,
      deterministicErrors,
      e2eErrors,
      evaluation: lastEvaluation,
    });

    log(
      `[cloud-converge] Invoking Gemini (${config.geminiModel}) to fix round ${round} findings...`
    );
    const snapshotSha = saveSnapshot();
    const geminiRes = execStep('npx', [
      'gemini',
      '-m',
      config.geminiModel,
      '--approval-mode=yolo',
      '--skip-trust',
      '-p',
      fixPrompt,
    ]);
    if ((geminiRes.timedOut || !geminiRes.ok) && snapshotSha) {
      // Require BOTH type-check and related unit tests to pass before retaining
      // timed-out / aborted partial edits; otherwise roll back cleanly!
      const tcCheck = execStep('pnpm', ['type-check']);
      let partialValid = tcCheck.ok;
      if (partialValid) {
        const latestEditedFiles = collectChangedFiles();
        const relTargets = latestEditedFiles.filter(
          (f) =>
            /\.(ts|tsx|js|jsx|mjs)$/.test(f) &&
            !f.startsWith('e2e/') &&
            fileExists(f)
        );
        if (relTargets.length > 0) {
          const unitCheck = execStep(
            'npx',
            ['vitest', 'related', ...relTargets, '--run', '--passWithNoTests'],
            { env: testEnv }
          );
          partialValid = unitCheck.ok;
        }
      }
      if (!partialValid) {
        log(
          `[cloud-converge] Gemini CLI aborted/timed out with broken checks in round ${round}; restoring clean pre-round snapshot (${snapshotSha.slice(0, 8)}).`
        );
        restoreSnapshot(snapshotSha);
      } else {
        log(
          `[cloud-converge] Gemini CLI timed out in round ${round}, and partial edits pass type-check + related unit tests; retaining valid progress.`
        );
      }
      if (
        geminiRes.timedOut &&
        timeoutResetsUsed < 1 &&
        consecutiveSameFingerprint > 0
      ) {
        timeoutResetsUsed += 1;
        previousFingerprint = '';
        consecutiveSameFingerprint = 0;
      }
    }
  }

  const summaryMd = formatConvergenceSummaryMarkdown({
    converged: false,
    stalled,
    roundsRun,
    maxRounds: config.maxRounds,
    runE2e: config.runE2e,
    e2ePassed: lastE2ePassed,
    changedSpecs: lastChangedSpecs,
    evaluation: lastEvaluation,
  });
  writeFile(config.summaryOut, summaryMd);

  return {
    converged: false,
    stalled,
    roundsRun,
    evaluation: lastEvaluation,
    summaryMd,
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  applyPhase2HeadlessWorkspaceLocks();
  const options = parseConvergeArgs(process.argv.slice(2), process.env);
  runConvergeLoop(options)
    .then((res) => {
      console.log(res.summaryMd);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cloud-converge] Fatal error:', err);
      process.exit(1);
    });
}
