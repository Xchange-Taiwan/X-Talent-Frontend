// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatComment, AI_REVIEW_COMMENT_MARKER } from './format-comment.mjs';

const noFindings = {
  hasFindings: false,
  summary: '未發現需要人工關注的問題',
  findings: [],
};

const oneFinding = (overrides = {}) => ({
  hasFindings: true,
  summary: '發現 1 個問題',
  findings: [
    {
      file: 'src/hooks/auth/useDeleteAccount.ts',
      line: 42,
      category: 'Error Handling',
      issue: 'API 失敗時沒有 catch',
      why: '使用者會看到卡住的 loading state',
      fix: '加上 try/catch 並顯示 toast',
    },
  ],
  ...overrides,
});

const basePlan = {
  ticketFound: true,
  ticketNumber: 999,
  requirementSummary: '這次改動加了刪除帳號流程。',
  acceptanceCriteria: ['只有三個測試帳號可以刪除', '刪除後導回首頁'],
};

describe('formatComment', () => {
  it('includes the marker as the very first line, for the find-or-update lookup', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment.startsWith(AI_REVIEW_COMMENT_MARKER)).toBe(true);
  });

  it('renders a clean "no findings" line for every agent when nothing was found', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('### 🔒 Security\n✅ 未發現需要人工關注的問題');
    expect(comment).toContain('### 🧪 Testing\n✅ 未發現需要人工關注的問題');
    expect(comment).toContain('### 🧪 Missing Tests\n（無）');
  });

  it('renders each finding with its category, location, why, and fix', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: oneFinding(),
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain(
      '**[Error Handling]** `src/hooks/auth/useDeleteAccount.ts:42`'
    );
    expect(comment).toContain('API 失敗時沒有 catch');
    expect(comment).toContain('為什麼重要：使用者會看到卡住的 loading state');
    expect(comment).toContain('建議修法：加上 try/catch 並顯示 toast');
  });

  it('omits the line number when a finding has none', () => {
    const finding = oneFinding();
    finding.findings[0].line = null;
    const comment = formatComment({
      plan: basePlan,
      security: finding,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('`src/hooks/auth/useDeleteAccount.ts`');
    expect(comment).not.toContain('`src/hooks/auth/useDeleteAccount.ts:null`');
  });

  it('marks a stage as "not run" when its result is undefined, instead of crashing', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: undefined,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('### 🧩 Correctness / Regression\n_（未執行）_');
  });

  it('handles a completely empty context object without throwing', () => {
    expect(() => formatComment({})).not.toThrow();
    const comment = formatComment({});
    expect(comment).toContain(AI_REVIEW_COMMENT_MARKER);
    expect(comment).toContain(
      '_（此 PR 找不到對應 ticket，無 acceptance criteria 可比對）_'
    );
  });

  it('renders "no ticket" for requirement coverage when Planner found none', () => {
    const comment = formatComment({
      plan: { ticketFound: false },
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain(
      '_（此 PR 找不到對應 ticket，無 acceptance criteria 可比對）_'
    );
  });

  it('renders "cannot judge" for requirement coverage when a ticket exists but Architecture gave no coverage', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('_（無法判斷）_');
  });

  it('renders each requirement-coverage entry with a check or warning icon', () => {
    const architecture = {
      ...noFindings,
      requirementCoverage: [
        {
          criterion: '只有三個測試帳號可以刪除',
          covered: true,
          note: '有檢查 email allowlist',
        },
        {
          criterion: '刪除後導回首頁',
          covered: false,
          note: '找不到對應的 router.push',
        },
      ],
      overallRisk: { level: 'medium', reason: '有一個未處理的錯誤路徑' },
      mergeRecommendation: '建議先補上錯誤處理再合併',
    };
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture,
    });
    expect(comment).toContain(
      '- ✅ 只有三個測試帳號可以刪除 — 有檢查 email allowlist'
    );
    expect(comment).toContain('- ⚠️ 刪除後導回首頁 — 找不到對應的 router.push');
    expect(comment).toContain('**medium** — 有一個未處理的錯誤路徑');
    expect(comment).toContain('建議先補上錯誤處理再合併');
  });

  it('lists every testing finding under Missing Tests', () => {
    const testing = oneFinding({ summary: '發現 2 個測試缺口' });
    testing.findings.push({
      file: 'src/schemas/deleteAccount.ts',
      line: null,
      category: 'Missing Test Coverage',
      issue: '沒有驗證測試',
      why: 'schema 邊界情況未驗證',
      fix: '補上 zod schema 測試',
    });
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing,
      architecture: noFindings,
    });
    expect(comment).toContain(
      '- `src/hooks/auth/useDeleteAccount.ts:42` — API 失敗時沒有 catch'
    );
    expect(comment).toContain(
      '- `src/schemas/deleteAccount.ts` — 沒有驗證測試'
    );
  });

  it('falls back to a placeholder merge recommendation when Architecture gave none', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: { ...noFindings },
    });
    expect(comment).toContain('### ✅ Merge Recommendation\n_（未提供）_');
  });
});
