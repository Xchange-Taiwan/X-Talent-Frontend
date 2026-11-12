// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  loadReviewVisualAssets,
  MAX_EVIDENCE_IMAGES as LOCAL_MAX_EVIDENCE,
} from './lib/visuals.mjs';
import {
  formatArchitectureKnowledgeBase,
  isUiReviewFile,
  resolveDesignSpecsFromKb,
} from './lib/ticket.mjs';
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
  });
});
