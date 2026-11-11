// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildGeminiParts } from './ai-review/lib/gemini.mjs';
import { loadReviewVisualAssets } from './ai-review/lib/visuals.mjs';
import { fileNameFor, parseArgs } from './capture-ui-evidence.mjs';

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);

describe('capture-ui-evidence & multimodal review helpers', () => {
  const tempDirs = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses interactive CLI flags (--click, --wait-for, --viewport-only, --label) accurately', () => {
    const parsed = parseArgs([
      '--routes',
      '/mentor-pool,/profile/123',
      '--role',
      'mentee',
      '--viewport',
      'mobile',
      '--click',
      '[aria-label*="通知"]',
      '--wait-for',
      '[role="dialog"]',
      '--viewport-only',
      '--label',
      'notification-open',
    ]);

    expect(parsed).toEqual({
      routes: ['/mentor-pool', '/profile/123'],
      role: 'mentee',
      viewport: 'mobile',
      outDir: '.agents/tmp/evidence',
      baseUrl: 'http://localhost:3000',
      clicks: ['[aria-label*="通知"]'],
      waitFor: '[role="dialog"]',
      viewportOnly: true,
      label: 'notification-open',
    });
  });

  it('throws clear errors on invalid role, viewport, or missing routes', () => {
    expect(() => parseArgs([])).toThrow(/Usage:/);
    expect(() => parseArgs(['--routes', '/', '--viewport', 'tablet'])).toThrow(
      /Unknown --viewport/
    );
    expect(() => parseArgs(['--routes', '/', '--role', 'admin'])).toThrow(
      /Unknown --role/
    );
  });

  it('builds Windows-safe filenames for root, query strings, and custom labels', () => {
    expect(fileNameFor('visitor', 'desktop', '/')).toBe(
      'visitor-desktop-root.png'
    );
    expect(fileNameFor('mentee', 'mobile', '/profile/12?tab=reviews')).toBe(
      'mentee-mobile-profile_12_tab_reviews.png'
    );
    expect(
      fileNameFor('mentor', 'desktop', '/', 'notification-popover-open')
    ).toBe('mentor-desktop-notification-popover-open.png');
  });

  it('loads genuine PNGs for multimodal Gemini review while ignoring invalid non-image files', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xtalent-vis-'));
    tempDirs.push(tmpRoot);

    const refDir = path.join(tmpRoot, 'ticket-images');
    const evidDir = path.join(tmpRoot, 'evidence');
    fs.mkdirSync(refDir, { recursive: true });
    fs.mkdirSync(evidDir, { recursive: true });

    fs.writeFileSync(path.join(refDir, 'ticket-img-01.png'), VALID_PNG);
    fs.writeFileSync(
      path.join(refDir, 'fake-login.png'),
      Buffer.from('<html>login</html>')
    );
    fs.writeFileSync(
      path.join(evidDir, 'desktop-notification-open.png'),
      VALID_PNG
    );

    const assets = loadReviewVisualAssets({
      ticketImagesDir: refDir,
      evidenceDir: evidDir,
    });

    expect(assets.refCount).toBe(1);
    expect(assets.evidenceCount).toBe(1);
    expect(assets.images).toHaveLength(2);
    expect(assets.visualContextMarkdown).toContain(
      '真正打開並呈現本次修改的目標元件'
    );

    const parts = buildGeminiParts('Review prompt', assets.images);
    expect(parts).toHaveLength(5);
    expect(parts[0]).toEqual({ text: 'Review prompt' });
    expect(parts[2]).toHaveProperty('inlineData.mimeType', 'image/png');
  });
});
