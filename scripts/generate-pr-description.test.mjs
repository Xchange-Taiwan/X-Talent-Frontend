// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  ensurePrTitleTag,
  extractExistingEvidenceUrls,
  extractSpecExcerptFromBundle,
  humanizeEvidenceSlug,
  loadStructuredBundle,
  parseCliArgs,
  renderPrMarkdown,
  runGeneratePrDescription,
} from './generate-pr-description.mjs';

const LF = String.fromCharCode(10);
const BT = String.fromCharCode(96);

describe('generate-pr-description', () => {
  it('reads cleanSpecMarkdown directly from structured ticket-bundle without magic-heading scraping', () => {
    const bundle = {
      ticketNumber: 737,
      cleanSpecMarkdown: ['title: [Feature] 導師卡平均分', '', '內容段落'].join(
        LF
      ),
      archKb: { huge: true },
    };
    expect(extractSpecExcerptFromBundle(bundle)).toBe(
      ['title: [Feature] 導師卡平均分', '', '內容段落'].join(LF)
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
    ].join(LF);

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
        overview: `實作尋找導師頁（${BT}/mentor-pool${BT}）導師卡片方案 B 平均評分與已完成 1-on-1 場次顯示規則，並於 0 則評價時自動隱藏分數區塊。`,
        moduleHighlights: [
          {
            title: '導師卡片方案 B 排版與條件渲染',
            files: ['src/components/mentor-pool/mentor-card/Information.tsx'],
            details: [
              `第一列姓名右側顯示純數字 ${BT}X.X / 10${BT} 平均分（不顯示星星與評價則數），0 則評價時整個分數區塊隱藏。`,
              `第二列滿寬呈現職稱與公司，第三列獨立顯示 ${BT}已完成 N 場 1-on-1${BT}。`,
            ],
          },
        ],
        demoRoutes: ['/mentor-pool'],
        screenshotCaptions: [
          `桌面版（${BT}/mentor-pool${BT}）— 呈現有評分、0 則評價隱藏分數與尚無場次三種導師卡狀態`,
        ],
      },
      evidenceUrls: [
        'https://raw.githubusercontent.com/Xchange-Taiwan/X-Talent-Frontend/sha/0-desktop-mentor-pool.png',
      ],
      summaryText: [
        '## Cloud Pre-PR AI Review & E2E Convergence Summary',
        '- 通過',
      ].join(LF),
    });

    expect(md).toContain(
      `實作尋找導師頁（${BT}/mentor-pool${BT}）導師卡片方案 B`
    );
    expect(md).toContain(
      `1. **導師卡片方案 B 排版與條件渲染** (${BT}src/components/mentor-pool/mentor-card/Information.tsx${BT})：`
    );
    expect(md).toContain(['## Demo', '', `- ${BT}/mentor-pool${BT}`].join(LF));
    expect(md).toContain(`### 1. 桌面版（${BT}/mentor-pool${BT}）`);
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

  it('prefers explicit --spec-file over default .agents/tmp/ticket-bundle.json when --bundle-file is omitted', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-pr-spec-win-'));
    try {
      const agentsTmp = path.join(tmpDir, '.agents', 'tmp');
      fs.mkdirSync(agentsTmp, { recursive: true });
      fs.writeFileSync(
        path.join(agentsTmp, 'ticket-bundle.json'),
        JSON.stringify({
          ticketNumber: 907,
          cleanSpecMarkdown: 'CACHED DEFAULT BUNDLE CONTENT',
        }),
        'utf8'
      );
      const customSpecPath = path.join(tmpDir, 'explicit-spec.md');
      fs.writeFileSync(customSpecPath, 'EXPLICIT SPEC FILE CONTENT', 'utf8');

      let capturedPrompt = '';
      const callGeminiSpy = vi.fn(async (prompt) => {
        capturedPrompt = prompt;
        return {
          prTitle: 'refactor(ci): tighten bundle precedence',
          overview: '測試明確傳入 spec-file 優先權。',
          moduleHighlights: [],
          demoRoutes: [],
          screenshotCaptions: [],
        };
      });

      const cliArgs = parseCliArgs([
        '--ticket=907',
        '--branch=refactor/907-cloud',
        `--spec-file=${customSpecPath}`,
      ]);
      expect(cliArgs.bundleFile).toBeUndefined();

      await runGeneratePrDescription({
        ...cliArgs,
        cwd: tmpDir,
        env: { GEMINI_API_KEY: 'test-key' },
        port: { git: () => '' },
        callGeminiImpl: callGeminiSpy,
      });

      expect(callGeminiSpy).toHaveBeenCalledTimes(1);
      expect(capturedPrompt).toContain('EXPLICIT SPEC FILE CONTENT');
      expect(capturedPrompt).not.toContain('CACHED DEFAULT BUNDLE CONTENT');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('validates expectedTicket against cached bundle ticketNumber and rejects stale cross-ticket bundles', async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gen-pr-ticket-check-')
    );
    try {
      const agentsTmp = path.join(tmpDir, '.agents', 'tmp');
      fs.mkdirSync(agentsTmp, { recursive: true });
      const bundlePath = path.join(agentsTmp, 'ticket-bundle.json');
      fs.writeFileSync(
        bundlePath,
        JSON.stringify({
          ticketNumber: 737,
          cleanSpecMarkdown: 'STALE TICKET 737 SPEC',
        }),
        'utf8'
      );

      expect(loadStructuredBundle(null, bundlePath, fs, '907')).toBeNull();
      expect(
        loadStructuredBundle(null, bundlePath, fs, '737')?.ticketNumber
      ).toBe(737);

      let mismatchPrompt = '';
      await runGeneratePrDescription({
        ...parseCliArgs(['--ticket=907', '--branch=refactor/907-cloud']),
        cwd: tmpDir,
        env: { GEMINI_API_KEY: 'test-key' },
        port: { git: () => '+const ok = true;' },
        callGeminiImpl: async (prompt) => {
          mismatchPrompt = prompt;
          return { prTitle: 'refactor(ci): test', overview: 'ok' };
        },
      });
      expect(mismatchPrompt).not.toContain('STALE TICKET 737 SPEC');

      fs.writeFileSync(
        bundlePath,
        JSON.stringify({
          ticketNumber: 907,
          cleanSpecMarkdown: 'MATCHING TICKET 907 SPEC',
        }),
        'utf8'
      );

      let matchPrompt = '';
      await runGeneratePrDescription({
        ...parseCliArgs(['--ticket=907', '--branch=refactor/907-cloud']),
        cwd: tmpDir,
        env: { GEMINI_API_KEY: 'test-key' },
        port: { git: () => '+const ok = true;' },
        callGeminiImpl: async (prompt) => {
          matchPrompt = prompt;
          return { prTitle: 'refactor(ci): test', overview: 'ok' };
        },
      });
      expect(matchPrompt).toContain('MATCHING TICKET 907 SPEC');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('preserves #!/usr/bin/env node shebang at line 1 for direct CLI execution', () => {
    const scriptPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      'generate-pr-description.mjs'
    );
    const raw = fs.readFileSync(scriptPath, 'utf8');
    expect(raw.startsWith(`#!/usr/bin/env node${LF}`)).toBe(true);
  });
});
