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

  it('includes discussion comments alongside top body via REST fallback', () => {
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
      return JSON.stringify([
        {
          user: { login: 'JeterChan' },
          created_at: '2026-11-13T05:32:13Z',
          body: '契約已定案為 COUNTERPART_ABSENT',
        },
        {
          user: { login: 'LowSugarCoke' },
          created_at: '2026-11-13T15:54:11Z',
          body: '/implement',
        },
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
    expect(parsed.body).toContain('契約已定案為 COUNTERPART_ABSENT');
    expect(parsed.body).not.toContain('/implement');
  });
});
