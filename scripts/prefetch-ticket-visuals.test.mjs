// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  downloadVerifiedImage,
  extractDesignUrlsFromTexts,
  extractMotionRulesFromCode,
  extractTicketImageCandidates,
  formatVisualManifestMarkdown,
  isAllowedPrototypeUrl,
  isAllowedTicketImageUrl,
  parsePrefetchArgs,
  prioritizeIssueAndCommentBlocks,
  sniffImageMimeType,
} from './prefetch-ticket-visuals.mjs';

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);

const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x20,
]);

describe('prefetch-ticket-visuals', () => {
  describe('sniffImageMimeType', () => {
    it('identifies genuine PNG, JPEG, and WEBP magic bytes', () => {
      expect(sniffImageMimeType(VALID_PNG)).toEqual({
        mimeType: 'image/png',
        ext: '.png',
      });
      expect(sniffImageMimeType(VALID_JPEG)).toEqual({
        mimeType: 'image/jpeg',
        ext: '.jpg',
      });
      expect(sniffImageMimeType(VALID_WEBP)).toEqual({
        mimeType: 'image/webp',
        ext: '.webp',
      });
    });

    it('rejects HTML login pages and truncated buffers', () => {
      const htmlBuf = Buffer.from(
        '<!DOCTYPE html><html>Sign in to GitHub</html>'
      );
      expect(sniffImageMimeType(htmlBuf)).toBeNull();
      expect(sniffImageMimeType(Buffer.from([0x89, 0x50]))).toBeNull();
    });
  });

  describe('URL allowlists (SSRF guard)', () => {
    it('accepts trusted GitHub attachment hosts and rejects untrusted/HTTP URLs', () => {
      expect(
        isAllowedTicketImageUrl(
          'https://private-user-images.githubusercontent.com/123/433313a3-030e-4866-bf40-3a53b283d26c.png?jwt=abc'
        )
      ).toBe(true);
      expect(
        isAllowedTicketImageUrl(
          'https://github.com/user-attachments/assets/433313a3-030e-4866-bf40-3a53b283d26c'
        )
      ).toBe(true);
      expect(
        isAllowedTicketImageUrl('http://github.com/user-attachments/assets/123')
      ).toBe(false);
      expect(isAllowedTicketImageUrl('https://github.com/login')).toBe(false);
      expect(isAllowedTicketImageUrl('https://169.254.169.254/latest')).toBe(
        false
      );
    });

    it('accepts Design Hub and *.chatgpt.site prototype URLs only over HTTPS', () => {
      expect(
        isAllowedPrototypeUrl('https://xtalent-chat-654.bonny80.chatgpt.site/')
      ).toBe(true);
      expect(
        isAllowedPrototypeUrl(
          'https://x-talent-design-hub.x-talent.workers.dev/pages/mentor-card-737.html'
        )
      ).toBe(true);
      expect(isAllowedPrototypeUrl('https://chatgpt.site/')).toBe(false);
      expect(isAllowedPrototypeUrl('https://evil-chatgpt.site/')).toBe(false);
    });
  });

  describe('prioritizeIssueAndCommentBlocks & extractTicketImageCandidates', () => {
    it('deduplicates UUIDs across body and body_html while preferring signed JWT URLs', () => {
      const uuid = '433313a3-030e-4866-bf40-3a53b283d26c';
      const blocks = [
        {
          body: `<img alt="導師個人頁 - 評價 Tab" src="https://github.com/user-attachments/assets/${uuid}" />`,
          body_html: `<p><img alt="導師個人頁 - 評價 Tab" src="https://private-user-images.githubusercontent.com/99/${uuid}.png?jwt=signed_token&amp;foo=1"></p>`,
        },
      ];

      const result = extractTicketImageCandidates(blocks);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: `https://private-user-images.githubusercontent.com/99/${uuid}.png?jwt=signed_token&foo=1`,
        alt: '導師個人頁 - 評價 Tab',
        isSigned: true,
      });
    });

    it('orders top issue description first, decorates comment-only image alt, and upgrades unsigned top URL with signed comment URL without losing top alt', () => {
      const sharedUuid = '11111111-2222-3333-4444-555555555555';
      const commentOnlyUuid = '99999999-8888-7777-6666-555555555555';
      const ordered = prioritizeIssueAndCommentBlocks(
        {
          body: `<img alt="頂部定案設計圖" src="https://github.com/user-attachments/assets/${sharedUuid}" />`,
          body_html: '',
        },
        [
          { body: 'old-oct-comment', body_html: '' },
          {
            body: '',
            body_html: `<img alt="留言簽章版" src="https://private-user-images.githubusercontent.com/1/${sharedUuid}.png?jwt=sig1"><img alt="補充情境" src="https://private-user-images.githubusercontent.com/1/${commentOnlyUuid}.png?jwt=sig2">`,
          },
        ]
      );
      expect(ordered[0]._fromComment).toBe(false);
      expect(ordered[1]._fromComment).toBe(true);

      const candidates = extractTicketImageCandidates(ordered);
      expect(candidates).toHaveLength(2);
      expect(candidates[0]).toEqual({
        url: `https://private-user-images.githubusercontent.com/1/${sharedUuid}.png?jwt=sig1`,
        alt: '頂部定案設計圖',
        isSigned: true,
      });
      expect(candidates[1].alt).toContain('補充情境');
      expect(candidates[1].alt).toContain('留言附圖');
    });
  });

  describe('extractDesignUrlsFromTexts & extractMotionRulesFromCode', () => {
    it('extracts public prototype URLs, resolves Design Hub KB screens + scenarios, and notes Figma/Claude links', () => {
      const texts = [
        '互動原型：https://xtalent-chat-654.bonny80.chatgpt.site/ 參考 Figma: https://www.figma.com/design/abc/X-talent?node-id=1-2 與 https://claude.ai/artifact/46EiPvwQhkbodzfGm6jvwT#D-1',
      ];
      const mockKb = {
        screens: [
          {
            id: 'mentor-card-737',
            module: 'standalone',
            hubUrl:
              'https://x-talent-design-hub.x-talent.workers.dev/screens/mentor-card-737.html',
            tickets: ['737'],
            scenarios: [
              { key: 'default', label: '預設' },
              { key: 'rating', label: '評分狀態' },
              { id: 'legacy-id' },
            ],
          },
          {
            id: 'fe-broken',
            module: 'frontend',
            path: 'pages/frontend.html',
            tickets: ['737'],
          },
        ],
      };

      const res = extractDesignUrlsFromTexts(texts, '737', mockKb);
      expect(res.prototypeUrls).toEqual([
        'https://xtalent-chat-654.bonny80.chatgpt.site/',
        'https://x-talent-design-hub.x-talent.workers.dev/screens/mentor-card-737.html',
        'https://x-talent-design-hub.x-talent.workers.dev/?view=screens&screen=mentor-card-737&device=desktop&scenario=rating&mode=play',
        'https://x-talent-design-hub.x-talent.workers.dev/?view=screens&screen=mentor-card-737&device=desktop&scenario=legacy-id&mode=play',
      ]);
      expect(res.skippedProtectedUrls).toHaveLength(2);
    });

    it('extracts @keyframes, transition/transform rules, and Web Animations API calls while stripping CSS comments and prefers-reduced-motion blocks', () => {
      const css = [
        '/* header comment */ @keyframes xt-enter { from { opacity: 0; transform: translateY(4px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }',
        '@media (prefers-reduced-motion: reduce) { .xt-dialog { animation: none !important; transition: none !important; } }',
        '.xt-back { transform: rotate(-5deg); border-radius: 8px; }',
        '.xt-dialog { animation: xt-enter 180ms cubic-bezier(.2,.8,.2,1); }',
      ];
      const js = [
        "await motion(card,[{transform:'translateX(0) rotate(0deg)',opacity:1},{transform:'translateX(-100px) rotate(-8deg)',opacity:0}],260);",
      ];
      const motion = extractMotionRulesFromCode(css, js);
      expect(motion.keyframes).toHaveLength(1);
      expect(motion.keyframes[0]).toContain('@keyframes xt-enter');
      expect(motion.transitionsAndTransforms.join('\n')).toContain(
        'rotate(-5deg)'
      );
      expect(motion.transitionsAndTransforms.join('\n')).not.toContain(
        'animation: none'
      );
      expect(motion.transitionsAndTransforms.join('\n')).not.toContain(
        'from {'
      );
      expect(motion.webAnimations).toHaveLength(1);
      expect(motion.webAnimations[0]).toContain('rotate(-8deg)');
    });
  });

  describe('downloadVerifiedImage', () => {
    it('follows github.com 302 redirect with token, then fetches signed S3 URL without leaking Authorization header', async () => {
      const calls = [];
      const mockFetch = vi.fn(async (url, opts = {}) => {
        calls.push({ url, headers: opts.headers || {} });
        if (String(url).startsWith('https://github.com/')) {
          return {
            ok: false,
            status: 302,
            headers: new Headers({
              location:
                'https://private-user-images.githubusercontent.com/1/a.png?jwt=xyz',
            }),
          };
        }
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
      });

      const downloaded = await downloadVerifiedImage(
        'https://github.com/user-attachments/assets/433313a3-030e-4866-bf40-3a53b283d26c',
        'ghp_secret_token',
        mockFetch
      );

      expect(downloaded?.mimeType).toBe('image/png');
      expect(calls).toHaveLength(2);
      expect(calls[0].headers.Authorization).toBe('Bearer ghp_secret_token');
      expect(calls[1].headers.Authorization).toBeUndefined();
    });

    it('returns null if server responds with an HTML login page instead of image bytes', async () => {
      const htmlBytes = Buffer.from('<!DOCTYPE html><html>Login</html>');
      const mockFetch = vi.fn(async (url) => ({
        ok: true,
        status: 200,
        url,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () =>
          htmlBytes.buffer.slice(
            htmlBytes.byteOffset,
            htmlBytes.byteOffset + htmlBytes.byteLength
          ),
      }));

      const res = await downloadVerifiedImage(
        'https://private-user-images.githubusercontent.com/1/a.png?jwt=expired',
        '',
        mockFetch
      );
      expect(res).toBeNull();
    });
  });

  describe('formatVisualManifestMarkdown & parsePrefetchArgs', () => {
    it('parses CLI flags and formats markdown instructions for Gemini read_file', () => {
      const parsed = parsePrefetchArgs(['--ticket=#736'], {});
      expect(parsed.ticketNumber).toBe('736');

      const md = formatVisualManifestMarkdown({
        downloadedImages: [
          {
            path: '.agents/tmp/ticket-images/ticket-img-01.png',
            mimeType: 'image/png',
            alt: '評價 Tab',
          },
        ],
        capturedPrototypes: [
          {
            url: 'https://xtalent-chat-654.bonny80.chatgpt.site/',
            imagePath: '.agents/tmp/ticket-images/prototype-01.png',
            domSpecPath: '.agents/tmp/ticket-images/prototype-01-dom.md',
          },
        ],
        skippedProtectedUrls: ['https://www.figma.com/design/abc'],
      });

      expect(md).toContain('ticket-img-01.png');
      expect(md).toContain('prototype-01-dom.md');
      expect(md).toContain('read_file');
    });
  });
});
