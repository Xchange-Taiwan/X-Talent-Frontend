// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildScopedImplementationGuidance,
  classifyTicketScopeDeterministic,
  evaluateTicketScope,
  parseIssueSpecMarkdown,
  sliceSpecPreservingHeadAndTail,
} from './check-ticket-scope.mjs';

describe('check-ticket-scope', () => {
  describe('parseIssueSpecMarkdown', () => {
    it('parses gh issue view output headers and body cleanly', () => {
      const raw = [
        'title:\t[Task][BE] 回饋功能 API 契約（待後端確認）',
        'state:\tOPEN',
        'author:\tJeterChan',
        'labels:\tenhancement',
        '--',
        '後端已依 #739 整理 BFF API 契約。',
      ].join('\n');

      const parsed = parseIssueSpecMarkdown(raw);
      expect(parsed.title).toBe('[Task][BE] 回饋功能 API 契約（待後端確認）');
      expect(parsed.state).toBe('OPEN');
      expect(parsed.body).toContain('BFF API 契約');
    });
  });

  describe('classifyTicketScopeDeterministic', () => {
    it('rejects CLOSED tickets immediately', () => {
      const res = classifyTicketScopeDeterministic({
        title: '[Feature] 某個已結案功能',
        body: '內容',
        state: 'CLOSED',
      });
      expect(res.decided).toBe(true);
      expect(res.actionableInFrontendRepo).toBe(false);
      expect(res.scope).toBe('non_frontend');
    });

    it('rejects [Epic] umbrella tickets even if they mention FE', () => {
      const res864 = classifyTicketScopeDeterministic({
        title:
          '[Epic][Data/FE] X-Talent 第一階段數據建設：GA4 標準埋點、BigQuery 倉儲與智慧洞察網站 v1',
        body: '## 子票清單\n- [ ] #865\n- [ ] #866',
        state: 'OPEN',
      });
      expect(res864.decided).toBe(true);
      expect(res864.actionableInFrontendRepo).toBe(false);

      const res738 = classifyTicketScopeDeterministic({
        title: '[Epic] 回饋：meeting 結束後的回饋',
        body: '## Child Issues\n- [ ] #730',
        state: 'OPEN',
      });
      expect(res738.decided).toBe(true);
      expect(res738.actionableInFrontendRepo).toBe(false);
    });

    it('rejects [Spike] and [提案] research/architecture tickets', () => {
      expect(
        classifyTicketScopeDeterministic({
          title: '[Spike][QA] X-Talent 進階測試體系演進藍圖',
          body: '',
          state: 'OPEN',
        }).actionableInFrontendRepo
      ).toBe(false);

      expect(
        classifyTicketScopeDeterministic({
          title: '[提案][BE][FE] 多語言（i18n）架構盤點與升級提案',
          body: '',
          state: 'OPEN',
        }).actionableInFrontendRepo
      ).toBe(false);
    });

    it('rejects explicit non-FE role tags ([BE], [Data], [PM/Data], [QA], [信件])', () => {
      const nonFeTitles = [
        '[Task][BE] 回饋功能 API 契約（待後端確認）',
        '[Task][BE] 會談結束提醒 Mentor 確認是否進行（站內通知＋email）',
        '[Task][Data] 完成 GA4 後台自訂維度註冊，並串接 BigQuery 每日自動匯出資料倉儲',
        '[Task][PM/Data] 內部數據與營運 Dashboard PRD 規劃（對接數據組）',
        '[Task][共通頁面][QA] 收藏功能測試、追蹤與成效指標',
        '[信件] 撰寫註冊確認信與重設密碼信文案',
      ];
      for (const title of nonFeTitles) {
        const res = classifyTicketScopeDeterministic({
          title,
          body: '',
          state: 'OPEN',
        });
        expect(res.decided, `Expected ${title} to be decided`).toBe(true);
        expect(
          res.actionableInFrontendRepo,
          `Expected ${title} to be non-actionable`
        ).toBe(false);
      }
    });

    it('keeps [Data/FE] and [FE] tagged tickets actionable for further evaluation', () => {
      const feTitles = [
        '[Task][Data/FE] GA4 基礎事件重構：修復初次進站 page_view',
        '[Task][FE] 個人連結新增 GitHub',
      ];
      for (const title of feTitles) {
        const res = classifyTicketScopeDeterministic({
          title,
          body: '修改 src/lib/analytics.ts',
          state: 'OPEN',
        });
        expect(res.actionableInFrontendRepo).not.toBe(false);
      }
    });
  });

  describe('evaluateTicketScope', () => {
    it('classifies mixed BE+FE tickets (#733 / #734) as actionable mixed_fe_be and builds scoped guidance', async () => {
      const mockClassifier = vi.fn().mockResolvedValue({
        scope: 'mixed_fe_be',
        actionableInFrontendRepo: true,
        frontendTasksSummary:
          '實作站內通知文案映射、/reservation/history?reservation_id 導頁與未登入 callbackUrl 導回。',
        outOfRepoItems: [
          '會談結束後 15 分鐘內發送站內通知與 Email 排程（屬 X-Talent-Backend）',
          '同一場去重與已取消預約過濾發信邏輯（屬 X-Talent-Backend）',
        ],
        reason: '本票包含後端排程寄信與前端點擊通知導頁兩部分。',
      });

      const res = await evaluateTicketScope(
        {
          title: '[Feature] 回饋：會談結束後提醒 Mentee 填寫回饋',
          body: '點擊通知導向歷史紀錄頁並開啟回饋彈窗；後端 15 分鐘內寄出 Email。',
          state: 'OPEN',
        },
        { callClassifier: mockClassifier }
      );

      expect(res.actionableInFrontendRepo).toBe(true);
      expect(res.scope).toBe('mixed_fe_be');
      expect(res.outOfRepoItems).toHaveLength(2);

      const guidance = buildScopedImplementationGuidance(res);
      expect(guidance).toContain('跨前後端混合票');
      expect(guidance).toContain('/reservation/history?reservation_id');
      expect(guidance).toContain('15 分鐘內發送站內通知與 Email');
    });

    it('rejects untagged pure-backend rule tickets (#732 / #739) when classifier identifies zero frontend work', async () => {
      const mockClassifier = vi.fn().mockResolvedValue({
        scope: 'non_frontend',
        actionableInFrontendRepo: false,
        frontendTasksSummary: '',
        outOfRepoItems: ['後端資料離開系統前完成姓名遮罩（王**）'],
        reason:
          '規格明定遮罩必須在資料離開後端系統前完成，前端僅直接顯示後端回傳字串，無獨立前端開發項目。',
      });

      const res = await evaluateTicketScope(
        {
          title: '[Feature] 回饋：公開評價的姓名遮罩規則',
          body: '遮罩必須在資料離開系統前完成，不能只靠畫面隱藏。',
          state: 'OPEN',
        },
        { callClassifier: mockClassifier }
      );

      expect(res.actionableInFrontendRepo).toBe(false);
      expect(res.scope).toBe('non_frontend');
      expect(res.reason).toContain('遮罩');
    });

    it('falls back safely to actionable=true when classifier throws on an untagged feature ticket', async () => {
      const failingClassifier = vi
        .fn()
        .mockRejectedValue(new Error('429 rate limit'));

      const res = await evaluateTicketScope(
        {
          title: '[Feature] 回饋：Mentee 填寫與送出回饋',
          body: '點擊填寫回饋按鈕開啟彈窗',
          state: 'OPEN',
        },
        { callClassifier: failingClassifier }
      );

      expect(res.actionableInFrontendRepo).toBe(true);
    });

    it('always allows promoted local branches to proceed while still preserving mixed_fe_be guidance', async () => {
      const resNonFe = await evaluateTicketScope(
        {
          title: '[Task][BE] 特殊跨端支援分支',
          body: '',
          state: 'OPEN',
        },
        { branchName: 'feat/760-fe-types-sync' }
      );
      expect(resNonFe.actionableInFrontendRepo).toBe(true);

      const mockClassifier = vi.fn().mockResolvedValue({
        scope: 'mixed_fe_be',
        actionableInFrontendRepo: true,
        frontendTasksSummary: '實作前端路由導頁',
        outOfRepoItems: ['後端 15 分鐘排程寄信'],
        reason: '混合票',
      });
      const resMixed = await evaluateTicketScope(
        {
          title: '[Feature] 回饋：會談結束後提醒 Mentee 填寫回饋',
          body: '內容',
          state: 'OPEN',
        },
        {
          branchName: 'feat/733-feedback-reminder-route',
          callClassifier: mockClassifier,
        }
      );
      expect(resMixed.actionableInFrontendRepo).toBe(true);
      expect(resMixed.scope).toBe('mixed_fe_be');
      expect(buildScopedImplementationGuidance(resMixed)).toContain(
        '後端 15 分鐘排程寄信'
      );
    });

    it('fails closed when both title and body are empty so headless VM never codes blind on unreadable specs', async () => {
      const spyClassifier = vi.fn();
      const res = await evaluateTicketScope(
        { title: '', body: '', state: 'OPEN' },
        { callClassifier: spyClassifier }
      );

      expect(res.actionableInFrontendRepo).toBe(false);
      expect(res.reason).toContain('未讀到規格');
      expect(spyClassifier).not.toHaveBeenCalled();
    });

    it('preserves both top description head and newest bottom comments tail, and blocks tickets with unresolved spec conflicts', async () => {
      const headPart = 'TOP_SPEC_ANCHOR ' + 'a'.repeat(7000);
      const middleNoise = 'MIDDLE_OLD_CHATTER ' + 'm'.repeat(10000);
      const tailPart = 'z'.repeat(1000) + ' LATEST_DISCORD_SETTLEMENT_ANCHOR';
      const sliced = sliceSpecPreservingHeadAndTail(
        `${headPart}\n${middleNoise}\n${tailPart}`,
        14000
      );
      expect(sliced).toContain('TOP_SPEC_ANCHOR');
      expect(sliced).toContain('LATEST_DISCORD_SETTLEMENT_ANCHOR');
      expect(sliced.length).toBeLessThan(14500);

      const conflictClassifier = vi.fn().mockResolvedValue({
        scope: 'frontend_only',
        actionableInFrontendRepo: true,
        specBlocked: true,
        specBlockReason:
          '最新留言正在詢問 PM 要採方案 A 或方案 B，尚未拍板定案',
        frontendTasksSummary: '實作回饋彈窗',
        outOfRepoItems: [],
        reason: '前端功能票',
      });
      const blockedRes = await evaluateTicketScope(
        {
          title: '[Feature] 回饋彈窗',
          body: '請問 @evan 要走方案 A 還是方案 B？待確認後開發',
          state: 'OPEN',
        },
        { callClassifier: conflictClassifier }
      );
      expect(blockedRes.actionableInFrontendRepo).toBe(false);
      expect(blockedRes.reason).toContain('方案 A 或方案 B');

      const omittedActionableClassifier = vi.fn().mockResolvedValue({
        scope: 'frontend_only',
        specBlocked: true,
        specBlockReason: '待設計師補齊彈窗圖稿',
      });
      const blockedOmitted = await evaluateTicketScope(
        { title: '[Feature] 彈窗', body: '待補圖', state: 'OPEN' },
        { callClassifier: omittedActionableClassifier }
      );
      expect(blockedOmitted.actionableInFrontendRepo).toBe(false);
      expect(blockedOmitted.reason).toContain('待設計師補齊彈窗圖稿');
    });
  });
});
