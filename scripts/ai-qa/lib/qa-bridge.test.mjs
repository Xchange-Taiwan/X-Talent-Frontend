// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  aggregateStatus,
  buildFindings,
  buildReportMarkdown,
} from './qa-bridge.mjs';

function scenario(overrides = {}) {
  return {
    id: 's1',
    role: 'mentee',
    route: '/jobs/1',
    description: '點擊應徵按鈕',
    expected: '應該看到成功訊息',
    ...overrides,
  };
}

describe('aggregateStatus', () => {
  it('is "failed" when any scenario failed, regardless of other statuses', () => {
    expect(
      aggregateStatus([
        { status: 'passed' },
        { status: 'infra-error' },
        { status: 'failed' },
      ])
    ).toBe('failed');
  });

  it('is "infra-error" when nothing failed but something errored', () => {
    expect(
      aggregateStatus([{ status: 'passed' }, { status: 'infra-error' }])
    ).toBe('infra-error');
  });

  it('is "passed" only when every scenario passed', () => {
    expect(aggregateStatus([{ status: 'passed' }, { status: 'passed' }])).toBe(
      'passed'
    );
  });

  it('is "passed" for an empty result set', () => {
    expect(aggregateStatus([])).toBe('passed');
  });
});

describe('buildFindings', () => {
  it('only includes failed scenarios, never infra-error or passed ones', () => {
    const results = [
      { scenario: scenario({ id: 'a' }), status: 'passed', reason: '' },
      {
        scenario: scenario({ id: 'b' }),
        status: 'infra-error',
        reason: 'dev server timeout',
      },
      {
        scenario: scenario({ id: 'c' }),
        status: 'failed',
        reason: '沒有出現成功訊息',
      },
    ];
    const findings = buildFindings(results);
    expect(findings).toHaveLength(1);
    expect(findings[0].source).toBe('🧪 QA Agent');
    expect(findings[0].why).toBe('沒有出現成功訊息');
    expect(findings[0].file).toBe('/jobs/1');
  });

  it('returns an empty array when nothing failed', () => {
    const results = [
      { scenario: scenario(), status: 'passed', reason: '' },
      { scenario: scenario(), status: 'infra-error', reason: 'boom' },
    ];
    expect(buildFindings(results)).toEqual([]);
  });
});

describe('buildReportMarkdown', () => {
  const ticket = { number: 318, title: 'AI QA Agent' };

  it('renders a scenario table with role/description/expected/status', () => {
    const results = [{ scenario: scenario(), status: 'passed', reason: '' }];
    const md = buildReportMarkdown({
      ticket,
      results,
      artifactsByScenario: new Map(),
      artifactsPublished: false,
    });
    expect(md).toContain('mentee');
    expect(md).toContain('點擊應徵按鈕');
    expect(md).toContain('應該看到成功訊息');
    expect(md).toContain('✅');
  });

  it('degrades to a text-only note when artifacts failed to publish', () => {
    const results = [{ scenario: scenario(), status: 'failed', reason: 'x' }];
    const md = buildReportMarkdown({
      ticket,
      results,
      artifactsByScenario: new Map(),
      artifactsPublished: false,
    });
    expect(md).toContain('截圖上傳失敗');
    expect(md).not.toContain('### 畫面截圖');
  });

  it('embeds screenshot URLs as markdown images when artifacts published', () => {
    const results = [
      { scenario: scenario({ id: 's1' }), status: 'passed', reason: '' },
    ];
    const artifactsByScenario = new Map([
      [
        's1',
        {
          desktopUrl:
            'https://gist.githubusercontent.com/user/gistid/raw/hash/s1-desktop.png',
        },
      ],
    ]);
    const md = buildReportMarkdown({
      ticket,
      results,
      artifactsByScenario,
      artifactsPublished: true,
    });
    expect(md).toContain(
      '![s1-desktop 改動前後對照](https://gist.githubusercontent.com/user/gistid/raw/hash/s1-desktop.png)'
    );
  });
});
