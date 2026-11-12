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

  it('renders a warning icon instead of a green check when a stage skipped due to transient API error', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      visualParity: {
        hasFindings: false,
        skippedDueToError: true,
        summary: '視覺審查因暫時性錯誤略過（Gemini API error 503）',
        findings: [],
      },
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain(
      '### 🎨 Visual / Design Parity\n⚠️ 視覺審查因暫時性錯誤略過（Gemini API error 503）'
    );
    expect(comment).not.toContain('✅ 視覺審查因暫時性錯誤略過');
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
    const summary = {
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
      architecture: noFindings,
      summary,
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

  it('renders Business Logic findings under their own section', () => {
    const businessLogic = oneFinding({
      summary: '發現 1 個業務規則違反',
      findings: [
        {
          file: 'src/app/auth/(sign)/onboarding/container.tsx',
          line: 115,
          category: 'Unreachable Logic',
          issue: 'onboarding 流程裡加了 isMentor 分支，但這裡永遠是 mentee',
          why: 'onboarding 尚未完成前使用者不可能是 mentor，這段永遠不會執行',
          fix: '移除此分支，mentor 專屬的頭像必填邏輯已在 profile/edit 實作',
        },
      ],
    });
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      businessLogic,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('### 🧭 Business Logic / Requirements');
    expect(comment).toContain('[Unreachable Logic]');
    expect(comment).toContain(
      'onboarding 流程裡加了 isMentor 分支，但這裡永遠是 mentee'
    );
  });

  it('renders "not run" for Business Logic when it is undefined, without affecting other sections', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain(
      '### 🧭 Business Logic / Requirements\n_（未執行）_'
    );
  });

  it('falls back to a placeholder merge recommendation when the final-judgment summary is missing entirely (e.g. that Gemini call failed)', () => {
    const comment = formatComment({
      plan: basePlan,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
      summary: undefined,
    });
    expect(comment).toContain('### ✅ Merge Recommendation\n_（未提供）_');
    expect(comment).toContain('### ⚠️ Overall Risk\n_（未提供）_');
    // the rest of the comment (each agent's own findings) must still render
    expect(comment).toContain('### 🔒 Security\n✅ 未發現需要人工關注的問題');
  });

  it('renders the review guide overview and reading order, sorted by the declared order field', () => {
    const reviewGuide = {
      overview: '這次變更把 X 功能拆成三層。',
      readingOrder: [
        {
          file: 'src/components/Foo.tsx',
          order: 3,
          why: '最後看畫面怎麼消費資料',
        },
        { file: 'src/schemas/foo.ts', order: 1, why: '先看資料形狀' },
        { file: 'src/hooks/useFoo.ts', order: 2, why: '再看怎麼用 schema' },
      ],
    };
    const comment = formatComment({
      plan: basePlan,
      reviewGuide,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });

    expect(comment).toContain('### 🧭 Review Guide');
    expect(comment).toContain('這次變更把 X 功能拆成三層。');

    const order1 = comment.indexOf('1. `src/schemas/foo.ts`');
    const order2 = comment.indexOf('2. `src/hooks/useFoo.ts`');
    const order3 = comment.indexOf('3. `src/components/Foo.tsx`');
    expect(order1).toBeGreaterThan(-1);
    expect(order1).toBeLessThan(order2);
    expect(order2).toBeLessThan(order3);
  });

  it('renders a "not run" placeholder for the review guide when it is missing, without affecting the rest of the comment', () => {
    const comment = formatComment({
      plan: basePlan,
      reviewGuide: undefined,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('### 🧭 Review Guide\n_（未執行）_');
    expect(comment).toContain('### 🔒 Security\n✅ 未發現需要人工關注的問題');
  });

  it('does not crash when the LLM returns readingOrder as a non-array (e.g. a string) instead of following the schema', () => {
    const reviewGuide = {
      overview: '這次變更把 X 功能拆成三層。',
      readingOrder: 'src/schemas/foo.ts, src/hooks/useFoo.ts',
    };

    expect(() =>
      formatComment({
        plan: basePlan,
        reviewGuide,
        security: noFindings,
        correctness: noFindings,
        performance: noFindings,
        testing: noFindings,
        architecture: noFindings,
      })
    ).not.toThrow();

    const comment = formatComment({
      plan: basePlan,
      reviewGuide,
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });
    expect(comment).toContain('這次變更把 X 功能拆成三層。');
    expect(comment).not.toContain('建議閱讀順序');
  });

  it('renders out_of_repo criteria as exempted (⏭️) instead of missing warnings (⚠️)', () => {
    const comment = formatComment({
      plan: {
        ...basePlan,
        outOfRepoCriteria: [
          '會談結束後 15 分鐘內，mentee 收到站內通知與 email',
        ],
      },
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
      summary: {
        overallRisk: { level: 'low', reason: '前端範圍皆已覆蓋' },
        mergeRecommendation: '可合併',
        requirementCoverage: [
          {
            criterion:
              '點擊通知或 email 連結，會到歷史紀錄頁並自動開啟回饋彈窗',
            scope: 'frontend',
            covered: true,
            note: '已實作路由與 query 參數處理',
          },
          {
            criterion: '同一場只會收到一次；已填寫、已取消的預約不會收到',
            scope: 'out_of_repo',
            covered: false,
            note: '屬後端排程去重邏輯，前端 PR 豁免檢查',
          },
        ],
      },
    });

    expect(comment).toContain(
      '- ✅ 點擊通知或 email 連結，會到歷史紀錄頁並自動開啟回饋彈窗 — 已實作路由與 query 參數處理'
    );
    expect(comment).toContain(
      '- ⏭️ 同一場只會收到一次；已填寫、已取消的預約不會收到 — 屬後端排程去重邏輯，前端 PR 豁免檢查'
    );
    expect(comment).toContain(
      '- ⏭️ 會談結束後 15 分鐘內，mentee 收到站內通知與 email — 屬後端或外部系統範圍，本前端 PR 豁免檢查'
    );
    expect(comment).not.toContain('- ⚠️');
  });

  it('surfaces unjudged frontend acceptanceCriteria when summary fails on a mixed ticket with outOfRepoCriteria', () => {
    const comment = formatComment({
      plan: {
        ...basePlan,
        acceptanceCriteria: ['點擊通知連結導向歷史紀錄頁'],
        outOfRepoCriteria: ['會談結束後 15 分鐘內收到 email'],
      },
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
      summary: undefined,
    });

    expect(comment).toContain(
      '- ⚠️ 點擊通知連結導向歷史紀錄頁 — 無法判斷（Summary 未回傳覆蓋結果）'
    );
    expect(comment).toContain(
      '- ⏭️ 會談結束後 15 分鐘內收到 email — 屬後端或外部系統範圍，本前端 PR 豁免檢查'
    );
  });

  it('renders Visual / Design Parity findings section when visualParity is provided', () => {
    const comment = formatComment({
      plan: basePlan,
      businessLogic: noFindings,
      visualParity: {
        hasFindings: true,
        summary: '發現 1 處與 Design Hub 設計圖不符的版面落差',
        findings: [
          {
            file: 'src/app/profile/[pageUserId]/ui.tsx',
            line: 120,
            category: 'Visual Drift - Missing or Partial Layout',
            issue: '頂部摘要列僅顯示 2 格，漏掉經驗、地點與產業列',
            why: '設計圖為滿寬 4 格摘要列加上產業膠囊列，目前右側大片留白',
            fix: '將經驗、地點併入滿寬 4 欄摘要列並於下方固定顯示產業標籤列',
          },
        ],
      },
      security: noFindings,
      correctness: noFindings,
      performance: noFindings,
      testing: noFindings,
      architecture: noFindings,
    });

    expect(comment).toContain('### 🎨 Visual / Design Parity');
    expect(comment).toContain('Visual Drift - Missing or Partial Layout');
  });
});
