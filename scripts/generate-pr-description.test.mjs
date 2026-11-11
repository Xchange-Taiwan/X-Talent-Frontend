// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  ensurePrTitleTag,
  extractExistingEvidenceUrls,
  humanizeEvidenceSlug,
  renderPrMarkdown,
  stripArchKbFromSpec,
} from './generate-pr-description.mjs';

describe('generate-pr-description', () => {
  it('strips appended Cloudflare Architecture KB JSON from ticket spec', () => {
    const raw =
      'title: [Feature] 導師卡平均分\n\n內容段落\n\n## X-Talent 跨專案架構知識庫 (Cloudflare KV Architecture KB)\n{"huge":true}';
    expect(stripArchKbFromSpec(raw)).toBe(
      'title: [Feature] 導師卡平均分\n\n內容段落'
    );
  });

  it('normalizes Conventional Commit PR titles with single (X-Tracker #<num>) suffix', () => {
    expect(
      ensurePrTitleTag(
        'feat(mentor-pool): display average rating on mentor cards (X-Tracker #737)',
        'feat/737-rating',
        '737'
      )
    ).toBe(
      'feat(mentor-pool): display average rating on mentor cards (X-Tracker #737)'
    );

    expect(
      ensurePrTitleTag(
        'feat(profile): add mentor summary bar and review tab.',
        'feat/736-reviews',
        '736'
      )
    ).toBe(
      'feat(profile): add mentor summary bar and review tab (X-Tracker #736)'
    );
  });

  it('preserves existing pr-evidence image URLs during fix-pr updates', () => {
    const body = [
      '## Screenshot',
      '![desktop](https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/abc123/feat-737/0-desktop-mentor-pool.png)',
      '![mobile](https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/abc123/feat-737/1-mobile-mentor-pool.png)',
    ].join('\n');

    expect(extractExistingEvidenceUrls(body)).toEqual([
      'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/abc123/feat-737/0-desktop-mentor-pool.png',
      'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/abc123/feat-737/1-mobile-mentor-pool.png',
    ]);
  });

  it('renders rich Traditional Chinese module highlights, Demo routes, and numbered screenshot captions', () => {
    const md = renderPrMarkdown({
      ticket: '737',
      branch: 'feat/737-mentor-card-average-rating',
      generated: {
        overview:
          '實作尋找導師頁（`/mentor-pool`）導師卡片方案 B 平均評分與已完成 1-on-1 場次顯示規則，並於 0 則評價時自動隱藏分數區塊。',
        moduleHighlights: [
          {
            title: '導師卡片方案 B 排版與條件渲染',
            files: ['src/components/mentor-pool/mentor-card/Information.tsx'],
            details: [
              '第一列姓名右側顯示純數字 `X.X / 10` 平均分（不顯示星星與評價則數），0 則評價時整個分數區塊隱藏。',
              '第二列滿寬呈現職稱與公司，第三列獨立顯示 `已完成 N 場 1-on-1`。',
            ],
          },
        ],
        demoRoutes: ['/mentor-pool'],
        screenshotCaptions: [
          '桌面版（`/mentor-pool`）— 呈現有評分、0 則評價隱藏分數與尚無場次三種導師卡狀態',
        ],
      },
      evidenceUrls: [
        'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/sha/0-desktop-mentor-pool.png',
      ],
      summaryText:
        '## Cloud Pre-PR AI Review & E2E Convergence Summary\n- 通過',
    });

    expect(md).toContain('實作尋找導師頁（`/mentor-pool`）導師卡片方案 B');
    expect(md).toContain(
      '1. **導師卡片方案 B 排版與條件渲染** (`src/components/mentor-pool/mentor-card/Information.tsx`)：'
    );
    expect(md).toContain('## Demo\n\n- `/mentor-pool`');
    expect(md).toContain('### 1. 桌面版（`/mentor-pool`）');
    expect(md).toContain(
      'Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/737'
    );
  });

  it('humanizes raw pr-evidence URL slugs cleanly when caption fallback is used', () => {
    expect(
      humanizeEvidenceSlug(
        'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/sha/feat-737/0-desktop-mentor-pool-card-rating-desktop.png',
        0
      )
    ).toBe('桌面版 (1280x800) — mentor pool card rating');
  });
});
