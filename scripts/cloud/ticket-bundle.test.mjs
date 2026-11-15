// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildTicketBundle,
  fetchFixPrSupplementalMarkdown,
  parseTicketBundleArgs,
} from './ticket-bundle.mjs';

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);

describe('scripts/cloud/ticket-bundle', () => {
  it('parses CLI flags cleanly', () => {
    const parsed = parseTicketBundleArgs(
      [
        '--ticket=#907',
        '--branch=refactor/907-cloud-modules',
        '--pr=555',
        '--frontend-repo=Xchange-Taiwan/X-Talent-Frontend',
        '--skip-prototypes=true',
      ],
      {}
    );
    expect(parsed).toMatchObject({
      ticketNumber: '907',
      branchName: 'refactor/907-cloud-modules',
      prNumber: '555',
      frontendRepo: 'Xchange-Taiwan/X-Talent-Frontend',
      skipPrototypes: true,
      skipVisuals: false,
      skipKb: false,
      reuseCachedIssue: true,
    });
  });

  it('discovers >100-comment visuals in a single-flight pass, bounds Architecture KB markdown, and reuses cached issue across pre-flight and Phase 1', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-bundle-'));
    try {
      const topUuid = '11111111-2222-3333-4444-555555555555';
      const comment105Uuid = '99999999-8888-7777-6666-555555555555';
      const topImgUrl = `https://private-user-images.githubusercontent.com/99/${topUuid}.png?jwt=top_sig`;
      const comment105ImgUrl = `https://private-user-images.githubusercontent.com/99/${comment105Uuid}.png?jwt=page2_sig`;

      const page1Comments = Array.from({ length: 100 }, (_, idx) => ({
        user: { login: `reviewer_${idx + 1}` },
        created_at: '2026-10-01T00:00:00Z',
        body: `Historical discussion comment #${idx + 1}`,
        body_html: `<p>Historical discussion comment #${idx + 1}</p>`,
      }));

      const page2Comments = [
        {
          user: { login: 'designer' },
          created_at: '2026-11-15T01:00:00Z',
          body: 'Comment #101 note',
          body_html: '<p>Comment #101 note</p>',
        },
        {
          user: { login: 'pm-lead' },
          created_at: '2026-11-15T09:30:00Z',
          body: `最新拍板設計稿 (#105): <img alt="最新設計稿 v3" src="${comment105ImgUrl}" />`,
          body_html: `<p>最新拍板設計稿 (#105): <img alt="最新設計稿 v3" src="${comment105ImgUrl}"></p>`,
        },
      ];

      const page2Url =
        'https://api.github.com/repos/Xchange-Taiwan/X-Talent-Tracker/issues/907/comments?per_page=100&page=2';

      let issueApiCalls = 0;
      let commentsApiCalls = 0;
      const hugePadding = 'X'.repeat(40_000);

      const fetchImpl = vi.fn(async (rawUrl) => {
        const url = String(rawUrl);
        if (url.endsWith('/repos/Xchange-Taiwan/X-Talent-Tracker/issues/907')) {
          issueApiCalls += 1;
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              number: 907,
              title: '[Refactor][FE/CI] Deepen Cloud AI modules',
              state: 'open',
              user: { login: 'LowSugarCoke' },
              labels: [{ name: 'ready-for-dev' }],
              body: `Top spec body <img alt="頂部規格圖" src="${topImgUrl}" />`,
              body_html: `<p>Top spec body <img alt="頂部規格圖" src="${topImgUrl}"></p>`,
            }),
          };
        }
        if (url.includes('/issues/907/comments') && !url.includes('page=2')) {
          commentsApiCalls += 1;
          return {
            ok: true,
            status: 200,
            headers: new Headers({ link: `<${page2Url}>; rel="next"` }),
            json: async () => page1Comments,
          };
        }
        if (url === page2Url) {
          commentsApiCalls += 1;
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => page2Comments,
          };
        }
        if (url.includes('/__arch-kb')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              kb: {
                matchedDesignSpecs: [{ id: 'card-907', notes: 'token-spec' }],
                extraHugePool: hugePadding,
              },
            }),
          };
        }
        if (url.includes('design-specs.json')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ screens: [] }),
          };
        }
        if (url === topImgUrl || url === comment105ImgUrl) {
          return {
            ok: true,
            status: 200,
            url,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: async () =>
              VALID_PNG.buffer.slice(
                VALID_PNG.byteOffset,
                VALID_PNG.byteOffset + VALID_PNG.byteLength
              ),
          };
        }
        return { ok: false, status: 404, headers: new Headers() };
      });

      const port = {
        git: vi.fn(() => ''),
        gh: vi.fn(() => ''),
      };

      // Stage 1: Pre-flight Scope Gate (--skip-visuals=true --skip-kb=true)
      const preflight = await buildTicketBundle({
        cwd: tmpDir,
        ticketNumber: '907',
        ghToken: 'ghp_test_token',
        skipVisuals: true,
        skipKb: true,
        fetchImpl,
        port,
      });

      expect(issueApiCalls).toBe(1);
      expect(commentsApiCalls).toBe(2);
      expect(preflight.bundle.issue.comments).toHaveLength(102);

      // Stage 2: Phase 1 full bundle reuses cached issue + comments (0 extra Tracker calls!)
      const fullRun = await buildTicketBundle({
        cwd: tmpDir,
        ticketNumber: '907',
        ghToken: 'ghp_test_token',
        skipPrototypes: true,
        fetchImpl,
        port,
      });

      expect(issueApiCalls).toBe(1);
      expect(commentsApiCalls).toBe(2);

      const downloaded = fullRun.bundle.visualManifest.downloadedImages;
      expect(downloaded).toHaveLength(2);
      expect(downloaded[0].alt).toBe('頂部規格圖');
      expect(downloaded[1].alt).toBe(
        '最新設計稿 v3 (留言附圖，若與頂部最新規格衝突請以頂部規格與 Design Hub 為準)'
      );

      // Clean spec in ticket-bundle.json has NO Architecture KB or visual manifest noise
      expect(fullRun.bundle.cleanSpecMarkdown).toContain(
        `title:${TAB}[Refactor][FE/CI] Deepen Cloud AI modules`
      );
      expect(fullRun.bundle.cleanSpecMarkdown).not.toContain(
        'Cloudflare KV Architecture KB'
      );

      // Bounded ticket-spec.md caps the 40,000-char KB payload via formatArchitectureKnowledgeBase
      expect(fullRun.fullSpecMarkdown).toContain(
        'Cloudflare KV Architecture KB'
      );
      expect(fullRun.fullSpecMarkdown.length).toBeLessThan(35_000);
      expect(fullRun.fullSpecMarkdown).toContain('ticket-img-02.png');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('enriches fix-pr runs with latest online AI Review comment and failed non-Vercel check annotations via CommandPort', () => {
    const port = {
      git: vi.fn(() => ''),
      gh: vi.fn((args) => {
        const joined = args.join(' ');
        if (joined.includes('/issues/512/comments')) {
          return (
            JSON.stringify([
              { body: '<!-- ai-review-pipeline --> Old round 1 review' },
            ]) +
            LF +
            JSON.stringify([
              { body: '<!-- ai-review-pipeline --> Latest round 2 finding' },
            ])
          );
        }
        if (joined === 'pr view 512 --json headRefOid') {
          return JSON.stringify({ headRefOid: 'deadbeef1234' });
        }
        if (joined.includes('/commits/deadbeef1234/check-runs')) {
          return JSON.stringify({
            check_runs: [
              {
                id: 10,
                name: 'Vercel Preview',
                conclusion: 'failure',
                output: { title: 'Quota' },
              },
              {
                id: 20,
                name: 'Unit Tests',
                conclusion: 'failure',
                output: { title: '1 test failed' },
              },
            ],
          });
        }
        if (joined.includes('/check-runs/20/annotations')) {
          return JSON.stringify([
            {
              path: 'src/lib/calc.test.ts',
              start_line: 42,
              annotation_level: 'failure',
              title: 'AssertionError',
              message: 'expected 1 to be 2',
            },
          ]);
        }
        return '[]';
      }),
    };

    const md = fetchFixPrSupplementalMarkdown({
      prNumber: '512',
      frontendRepo: 'Xchange-Taiwan/X-Talent-Frontend',
      port,
    });

    expect(md).toContain('Latest round 2 finding');
    expect(md).not.toContain('Old round 1 review');
    expect(md).toContain('### Unit Tests');
    expect(md).not.toContain('Vercel Preview');
    expect(md).toContain('`src/lib/calc.test.ts:42` [failure] AssertionError');
  });
});
