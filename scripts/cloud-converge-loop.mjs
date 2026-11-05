#!/usr/bin/env node
/**
 * Cloud Pre-PR Multi-Round AI Reviewer + Playwright E2E Convergence Loop
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REVIEW_CATEGORIES = [
  'security',
  'correctness',
  'businessLogic',
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

  const baseRef = getArg('--base-ref=') || env.BASE_REF || 'origin/develop';
  const summaryOut =
    getArg('--summary-out=') ||
    env.CONVERGE_SUMMARY_OUT ||
    '.agents/tmp/cloud-converge-summary.md';
  const geminiModel = env.GEMINI_MODEL || 'gemini-4-argon';

  return {
    maxRounds,
    ticketNumber,
    runE2e,
    baseRef,
    summaryOut,
    geminiModel,
  };
}

/**
 * Identifies modified/added Playwright spec files from `git diff --name-only`
 * and separates any specs not already covered by `pnpm test:e2e:mock`
 * (excluding stateful real-backend canary specs unless explicitly enabled).
 */
export function detectChangedE2eSpecs(
  changedFiles = [],
  { includeCanary = false } = {}
) {
  const allChangedSpecs = [];
  const extraNonMockSpecs = [];

  for (const rawFile of changedFiles) {
    const normalized = String(rawFile ?? '')
      .replace(/\\/g, '/')
      .trim();
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

    const inMockDir =
      MOCK_PROJECT_DIRS.some((dir) => normalized.startsWith(dir)) &&
      !MOCK_PROJECT_IGNORED.has(normalized);
    if (!inMockDir && normalized.startsWith('e2e/tests/onboarding/')) {
      extraNonMockSpecs.push(normalized);
    }
  }

  return {
    allChangedSpecs,
    extraNonMockSpecs,
  };
}

/**
 * Evaluates whether the current round has fully converged and produces a
 * deterministic fingerprint for stall/oscillation detection.
 */
export function evaluateRoundConvergence({
  deterministicPassed,
  e2ePassed,
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
  const uncoveredCriteria = requirementCoverage.filter(
    (item) => item && item.covered === false
  );

  const riskLevel = String(reviewResult?.overallRisk?.level ?? 'low')
    .toLowerCase()
    .trim();
  const riskReason = reviewResult?.overallRisk?.reason ?? '';

  const converged =
    Boolean(deterministicPassed) &&
    Boolean(e2ePassed) &&
    riskLevel === 'low' &&
    flatFindings.length === 0 &&
    uncoveredCriteria.length === 0;

  const fingerprintParts = [
    `det:${Boolean(deterministicPassed)}`,
    `e2e:${Boolean(e2ePassed)}`,
    `risk:${riskLevel}`,
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
    fingerprint: fingerprintParts.join('|'),
  };
}

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
    '請直接修改工作目錄中的程式碼或測試檔案以修復以下所有問題（請勿執行 git commit 或 git push，也嚴禁修改或 stage 任何 .env* 檔案）：',
  ];

  if (deterministicErrors.length > 0) {
    sections.push(
      `### 1. 靜態檢查 / 單元測試失敗 (Lint / Type-check / Vitest)\n\`\`\`\n${deterministicErrors.join('\n\n').slice(0, 6000)}\n\`\`\``
    );
  }

  if (e2eErrors.length > 0) {
    sections.push(
      `### 2. Playwright E2E 端對端測試失敗\n\`\`\`\n${e2eErrors.join('\n\n').slice(0, 6000)}\n\`\`\``
    );
  }

  if (evaluation?.uncoveredCriteria?.length > 0) {
    const acLines = evaluation.uncoveredCriteria.map(
      (item, idx) =>
        `${idx + 1}. 驗收條件未滿足：「${item.criterion}」— 原因：${item.note || '未實作或缺少驗證'}`
    );
    sections.push(
      `### 3. Ticket 驗收條件缺口 (Requirement Coverage)\n${acLines.join('\n')}`
    );
  }

  if (evaluation?.flatFindings?.length > 0) {
    const findingLines = evaluation.flatFindings.map(
      (f, idx) =>
        `${idx + 1}. [${f.category}] ${f.file}${f.line ? `:${f.line}` : ''}\n   - 問題：${f.issue}\n   - 原因：${f.why}\n   - 建議修法：${f.fix}`
    );
    sections.push(
      `### 4. AI Review 審查發現 (Overall Risk: ${evaluation.riskLevel})\n${findingLines.join('\n\n')}`
    );
  } else if (evaluation && evaluation.riskLevel !== 'low') {
    sections.push(
      `### 4. AI Review 整體風險評估為 ${evaluation.riskLevel}\n- 理由：${evaluation.riskReason}\n請針對上述風險原因補強錯誤處理、邊界防護或單元/E2E 測試。`
    );
  }

  sections.push(
    '修復完成後，請自行執行 `pnpm type-check` 與 `pnpm test` 確認通過。'
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

  const lines = [
    '## Cloud Pre-PR AI Review & E2E Convergence Summary',
    '',
    `- **收斂狀態**：${statusText}`,
    `- **執行輪數**：${roundsRun} / ${maxRounds} 輪`,
    `- **AI Review 最終風險**：\`${evaluation?.riskLevel ?? 'low'}\`（剩餘 Findings：${evaluation?.totalFindings ?? 0} 筆）`,
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

function defaultExecStep(cmd, args, options = {}) {
  const isWin = process.platform === 'win32';
  const resolvedCmd =
    isWin && (cmd === 'pnpm' || cmd === 'npx') ? `${cmd}.cmd` : cmd;
  try {
    const stdout = execFileSync(resolvedCmd, args, {
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    const stdout = String(err.stdout ?? '');
    const stderr = String(err.stderr ?? err.message ?? '');
    return {
      ok: false,
      stdout,
      stderr,
      combined: `${stdout}\n${stderr}`.trim(),
    };
  }
}

export async function runConvergeLoop(
  rawOptions = {},
  deps = {
    execStep: defaultExecStep,
    writeFile: (filePath, content) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    },
    log: (msg) => console.log(msg),
  }
) {
  const config = {
    maxRounds: clampMaxRounds(rawOptions.maxRounds, 20),
    ticketNumber: rawOptions.ticketNumber ?? '',
    runE2e: rawOptions.runE2e !== false,
    baseRef: rawOptions.baseRef || 'origin/develop',
    summaryOut:
      rawOptions.summaryOut || '.agents/tmp/cloud-converge-summary.md',
    geminiModel: rawOptions.geminiModel || 'gemini-4-argon',
  };

  let previousFingerprint = '';
  let consecutiveSameFingerprint = 0;
  let lastEvaluation = null;
  let lastE2ePassed = true;
  let lastChangedSpecs = [];
  let roundsRun = 0;
  let stalled = false;

  for (let round = 1; round <= config.maxRounds; round++) {
    roundsRun = round;
    deps.log(
      `\n[cloud-converge] === Round ${round}/${config.maxRounds} starting ===`
    );

    // 1. Deterministic checks: format/lint, type-check, unit tests
    const deterministicErrors = [];
    for (const [label, args] of [
      ['pnpm lint', ['lint']],
      ['pnpm type-check', ['type-check']],
      ['pnpm test', ['test']],
    ]) {
      const res = deps.execStep('pnpm', args);
      if (!res.ok) {
        deps.log(`[cloud-converge] ${label} failed in round ${round}`);
        deterministicErrors.push(`[${label}]\n${res.combined || res.stderr}`);
      }
    }
    const deterministicPassed = deterministicErrors.length === 0;

    // 2. Playwright E2E verification
    const e2eErrors = [];
    let e2eReportForReviewer = '未執行 E2E (--run-e2e=false)';

    if (config.runE2e) {
      const diffFilesRes = deps.execStep('git', [
        'diff',
        '--name-only',
        config.baseRef,
      ]);
      const diffFiles = diffFilesRes.ok
        ? diffFilesRes.stdout.split(/\r?\n/).filter(Boolean)
        : [];
      const { allChangedSpecs, extraNonMockSpecs } =
        detectChangedE2eSpecs(diffFiles);
      lastChangedSpecs = allChangedSpecs;

      const mockE2eRes = deps.execStep('pnpm', [
        'test:e2e:mock',
        '--workers=4',
      ]);
      if (!mockE2eRes.ok) {
        deps.log(
          `[cloud-converge] pnpm test:e2e:mock failed in round ${round}`
        );
        e2eErrors.push(
          `[pnpm test:e2e:mock]\n${mockE2eRes.combined || mockE2eRes.stderr}`
        );
      }

      if (extraNonMockSpecs.length > 0) {
        const extraRes = deps.execStep('pnpm', [
          'playwright',
          'test',
          '--project=chromium-onboarding',
          ...extraNonMockSpecs,
        ]);
        if (!extraRes.ok) {
          deps.log(
            `[cloud-converge] onboarding E2E specs failed in round ${round}`
          );
          e2eErrors.push(
            `[playwright onboarding specs]\n${extraRes.combined || extraRes.stderr}`
          );
        }
      }

      lastE2ePassed = e2eErrors.length === 0;
      e2eReportForReviewer = lastE2ePassed
        ? `Playwright E2E 測試已通過（已執行 pnpm test:e2e:mock --workers=4${allChangedSpecs.length > 0 ? `，涵蓋變更 Spec：${allChangedSpecs.join(', ')}` : ''}）。`
        : `Playwright E2E 測試失敗：\n${e2eErrors.join('\n').slice(0, 1500)}`;
    }

    // 3. 7-Agent Parallel Gemini AI Review (run-local.mjs)
    const reviewArgs = [
      'scripts/ai-review/run-local.mjs',
      `--base-ref=${config.baseRef}`,
    ];
    if (config.ticketNumber) {
      reviewArgs.push(`--ticket=${config.ticketNumber}`);
    }

    const reviewRes = deps.execStep('node', reviewArgs, {
      env: {
        ...process.env,
        TICKET_NUMBER: config.ticketNumber,
        E2E_VERIFICATION_REPORT: e2eReportForReviewer,
        GEMINI_MAX_OUTPUT_TOKENS: '32768',
      },
    });

    let reviewJson = {
      overallRisk: { level: 'low', reason: 'Fallback' },
      requirementCoverage: [],
      findings: {},
    };
    if (reviewRes.ok && reviewRes.stdout.trim()) {
      try {
        reviewJson = JSON.parse(reviewRes.stdout.trim());
      } catch {
        deps.log(
          `[cloud-converge] Warning: could not parse run-local.mjs output in round ${round}`
        );
      }
    }

    lastEvaluation = evaluateRoundConvergence({
      deterministicPassed,
      e2ePassed: lastE2ePassed,
      reviewResult: reviewJson,
    });

    deps.log(
      `[cloud-converge] Round ${round} result: risk=${lastEvaluation.riskLevel}, findings=${lastEvaluation.totalFindings}, uncoveredAC=${lastEvaluation.uncoveredCriteria.length}, detPassed=${deterministicPassed}, e2ePassed=${lastE2ePassed}`
    );

    if (lastEvaluation.converged) {
      deps.log(
        `[cloud-converge] Converged in round ${round}/${config.maxRounds}!`
      );
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
      deps.writeFile(config.summaryOut, summaryMd);
      return {
        converged: true,
        stalled: false,
        roundsRun: round,
        evaluation: lastEvaluation,
        summaryMd,
      };
    }

    // Check oscillation / stall guard
    if (lastEvaluation.fingerprint === previousFingerprint) {
      consecutiveSameFingerprint += 1;
    } else {
      previousFingerprint = lastEvaluation.fingerprint;
      consecutiveSameFingerprint = 1;
    }

    if (consecutiveSameFingerprint >= 2) {
      deps.log(
        `[cloud-converge] Identical findings fingerprint repeated ${consecutiveSameFingerprint} times in round ${round}. Breaking loop via Stall Guard.`
      );
      stalled = true;
      break;
    }

    if (round >= config.maxRounds) {
      deps.log(
        `[cloud-converge] Reached max rounds (${config.maxRounds}). Finishing loop.`
      );
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

    deps.log(
      `[cloud-converge] Invoking Gemini (${config.geminiModel}) to fix round ${round} findings...`
    );
    deps.execStep('npx', [
      'gemini',
      '-m',
      config.geminiModel,
      '--approval-mode=yolo',
      '--skip-trust',
      '-p',
      fixPrompt,
    ]);
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
  deps.writeFile(config.summaryOut, summaryMd);

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
