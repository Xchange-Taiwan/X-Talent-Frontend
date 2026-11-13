// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { parseIssueSpecMarkdown } from './check-ticket-scope.mjs';
import {
  fetchIssueSpecViaGh,
  formatIssueJsonToSpecMarkdown,
  isPureCommandComment,
} from './export-ticket-spec.mjs';

describe('export-ticket-spec', () => {
  it('identifies pure slash-command trigger comments accurately', () => {
    expect(isPureCommandComment('/implement')).toBe(true);
    expect(isPureCommandComment('  /implement --force  ')).toBe(true);
    expect(isPureCommandComment('/fix-pr')).toBe(true);
    expect(isPureCommandComment('/skip-qa')).toBe(true);
    expect(isPureCommandComment('/implement 請改用 COUNTERPART_ABSENT')).toBe(
      false
    );
    expect(isPureCommandComment('正常規格補充說明')).toBe(false);
  });

  it('preserves title and top body when ticket has only /implement', () => {
    const md = formatIssueJsonToSpecMarkdown({
      number: 874,
      title: '[Refactor][FE] 對齊會談回饋 #760 最終契約',
      state: 'OPEN',
      author: { login: 'LowSugarCoke' },
      labels: [{ name: 'enhancement' }],
      body: '<!-- no-discord-notify -->\n## 實作需求\n1. COUNTERPART_ABSENT',
      comments: [
        {
          author: { login: 'LowSugarCoke' },
          createdAt: '2026-11-13T15:53:57Z',
          body: '/implement',
        },
      ],
    });

    const parsed = parseIssueSpecMarkdown(md);
    expect(parsed.title).toBe('[Refactor][FE] 對齊會談回饋 #760 最終契約');
    expect(parsed.state).toBe('OPEN');
    expect(parsed.body).toContain('COUNTERPART_ABSENT');
    expect(parsed.body).not.toContain('/implement');
  });

  it('uses gh issue view --json primary path first', () => {
    const execGh = vi.fn(() =>
      JSON.stringify({
        number: 874,
        title: '[Refactor][FE] 主路徑測試',
        state: 'OPEN',
        author: { login: 'LowSugarCoke' },
        labels: ['enhancement'],
        body: '主路徑內文說明',
        comments: {
          nodes: [
            {
              author: { login: 'EvanCWChang' },
              createdAt: '2026-11-13T04:03:27Z',
              body: '確認採用 COUNTERPART_ABSENT',
            },
          ],
        },
      })
    );

    const md = fetchIssueSpecViaGh(
      { ticketNumber: '874', token: 'tok' },
      { execGh }
    );
    expect(execGh).toHaveBeenCalledTimes(1);
    const parsed = parseIssueSpecMarkdown(md);
    expect(parsed.title).toBe('[Refactor][FE] 主路徑測試');
    expect(parsed.body).toContain('主路徑內文說明');
    expect(parsed.body).toContain('確認採用 COUNTERPART_ABSENT');
  });

  it('flattens multi-page --slurp arrays in REST fallback', () => {
    const execGh = vi.fn((_bin, args) => {
      if (args[0] === 'issue') {
        throw new Error('GraphQL projectItems forbidden');
      }
      if (String(args[1]).endsWith('/issues/875')) {
        return JSON.stringify({
          number: 875,
          title: '[Refactor][FE] 補齊深連結路由',
          state: 'open',
          user: { login: 'LowSugarCoke' },
          labels: [],
          body: '新增 /reservation/history 路由',
        });
      }
      expect(args).toContain('--slurp');
      return JSON.stringify([
        [
          {
            user: { login: 'JeterChan' },
            created_at: '2026-11-13T05:32:13Z',
            body: '第一頁留言：COUNTERPART_ABSENT',
          },
        ],
        [
          {
            user: { login: 'EvanCWChang' },
            created_at: '2026-11-13T06:00:00Z',
            body: '第二頁留言：超過 100 則跨頁保留',
          },
          {
            user: { login: 'LowSugarCoke' },
            created_at: '2026-11-13T15:54:11Z',
            body: '/implement',
          },
        ],
      ]);
    });

    const md = fetchIssueSpecViaGh(
      { ticketNumber: '#875', token: 'tok' },
      { execGh }
    );
    const parsed = parseIssueSpecMarkdown(md);
    expect(parsed.title).toBe('[Refactor][FE] 補齊深連結路由');
    expect(parsed.state).toBe('OPEN');
    expect(parsed.body).toContain('新增 /reservation/history 路由');
    expect(parsed.body).toContain('第一頁留言：COUNTERPART_ABSENT');
    expect(parsed.body).toContain('第二頁留言：超過 100 則跨頁保留');
    expect(parsed.body).not.toContain('/implement');
  });

  it('rejects invalid ticket numbers and repo identifiers', () => {
    for (const badTicket of ['', 'abc', '#12;rm -rf /']) {
      expect(() => fetchIssueSpecViaGh({ ticketNumber: badTicket })).toThrow(
        /Invalid ticket number/
      );
    }
    expect(() =>
      fetchIssueSpecViaGh({ ticketNumber: '874', repo: '../bad' })
    ).toThrow(/Invalid repository identifier/);
    expect(() =>
      fetchIssueSpecViaGh({ ticketNumber: '874', repo: '../bad/repo/path' })
    ).toThrow(/Invalid repository identifier/);
  });
});
