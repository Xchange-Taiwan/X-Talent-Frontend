// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  formatArchitectureKnowledgeBase,
  isUiReviewFile,
  resolveDesignSpecsFromKb,
} from './lib/ticket.mjs';
import {
  loadReviewVisualAssets,
  MAX_EVIDENCE_IMAGES as LOCAL_MAX_EVIDENCE,
} from './lib/visuals.mjs';
import {
  MAX_EVIDENCE_IMAGES,
  shouldSkipVisualParity,
} from './visual-parity.mjs';

describe('visual-parity & Design Hub KB helpers', () => {
  it('identifies genuine UI files while excluding API routes, tests, and stories', () => {
    expect(isUiReviewFile('src/app/profile/[pageUserId]/ui.tsx')).toBe(true);
    expect(isUiReviewFile('src/components/profile/MentorTabs.tsx')).toBe(true);
    expect(isUiReviewFile('src/styles/global.css')).toBe(true);
    expect(isUiReviewFile('src/app/api/auth/[...nextauth]/route.ts')).toBe(
      false
    );
    expect(isUiReviewFile('src/app/profile/utils.ts')).toBe(false);
    expect(isUiReviewFile('src/components/Foo.stories.tsx')).toBe(false);
    expect(isUiReviewFile('src/components/Foo.test.tsx')).toBe(false);
  });

  it('normalizes matchedDesignSpecs and falls back to design_hub domain while rejecting empty objects/arrays', () => {
    expect(resolveDesignSpecsFromKb(null)).toBeNull();
    expect(
      resolveDesignSpecsFromKb({
        matchedDesignSpecs: {},
        matchedDomains: { design_hub: [] },
      })
    ).toBeNull();

    const fallbackSpec = { screens: [{ id: 'public-profile' }] };
    expect(
      resolveDesignSpecsFromKb({
        matchedDesignSpecs: {},
        matchedDomains: { design_hub: fallbackSpec },
      })
    ).toEqual(fallbackSpec);
  });

  it('keeps matchedDesignSpecs intact ahead of huge ticketsPool in formatted KB markdown', () => {
    const hugePool = { items: 'x'.repeat(20000) };
    const formatted = formatArchitectureKnowledgeBase({
      matchedDesignSpecs: {
        ticketNumbers: ['736'],
        rules: ['滿寬 4 格摘要列'],
      },
      matchedDomains: { feedback: { domain: 'feedback' } },
      ticketsPool: hugePool,
    });

    expect(formatted).toContain('Design Hub 定案畫面與元件規格');
    expect(formatted).toContain('滿寬 4 格摘要列');
    expect(formatted.indexOf('滿寬 4 格摘要列')).toBeLessThan(
      formatted.indexOf('ticketsPool')
    );
  });

  it('determines skip vs run accurately for visual parity stage', () => {
    expect(
      shouldSkipVisualParity({ hasUiChanges: false, refImagesCount: 2 }).skip
    ).toBe(true);
    expect(
      shouldSkipVisualParity({
        hasUiChanges: true,
        refImagesCount: 0,
        prImagesCount: 0,
        designSpecsObj: null,
      }).skip
    ).toBe(true);
    expect(
      shouldSkipVisualParity({
        hasUiChanges: true,
        refImagesCount: 0,
        prImagesCount: 0,
        designSpecsObj: { screens: [{ id: 'public-profile' }] },
      }).skip
    ).toBe(false);
    expect(MAX_EVIDENCE_IMAGES).toBe(8);
    expect(LOCAL_MAX_EVIDENCE).toBe(8);
    expect(
      loadReviewVisualAssets({
        ticketImagesDir: '__non_existent_refs__',
        evidenceDir: '__non_existent_ev__',
      }).evidenceCount
    ).toBe(0);

    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'visual-parity-cap-')
    );
    const evDir = path.join(tmpRoot, 'evidence');
    fs.mkdirSync(evDir, { recursive: true });
    // Minimal 1x1 PNG header + bytes recognized by sniffImageMimeType
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    try {
      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(path.join(evDir, `shot-${i}.png`), tinyPng);
      }
      const loaded = loadReviewVisualAssets({
        ticketImagesDir: '__non_existent_refs__',
        evidenceDir: evDir,
      });
      expect(loaded.evidenceCount).toBe(8);
      expect(loaded.evidenceImages).toHaveLength(8);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('injects *-dom.md computed style & motion rules into visualContextMarkdown when present in ticketImagesDir', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-dom-md-'));
    const refDir = path.join(tmpRoot, 'ticket-images');
    fs.mkdirSync(refDir, { recursive: true });
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    try {
      fs.writeFileSync(path.join(refDir, 'prototype-01.png'), tinyPng);
      fs.writeFileSync(
        path.join(refDir, 'prototype-01-dom.md'),
        '# Prototype Motion\n```css\n.xt-back { transform: rotate(-5deg); }\n```\n',
        'utf8'
      );
      const loaded = loadReviewVisualAssets({
        ticketImagesDir: refDir,
        evidenceDir: '__non_existent_ev__',
      });
      expect(loaded.refCount).toBe(1);
      expect(loaded.visualContextMarkdown).toContain('rotate(-5deg)');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
