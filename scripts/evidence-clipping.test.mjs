// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { detectDialogStickyFooterClipping } from '../e2e/helpers/evidence.ts';

describe('detectDialogStickyFooterClipping (720p Dialog & Sticky Footer Gate)', () => {
  it('passes when dialog fits inside 720p viewport and warning box sits cleanly above sticky footer', () => {
    const err = detectDialogStickyFooterClipping({
      viewportHeight: 720,
      dialogs: [
        {
          top: 40,
          bottom: 696,
          stickyFooters: [{ top: 620, bottom: 696 }],
          protectedBlocks: [{ label: '送出後不能修改', top: 556, bottom: 608 }],
        },
      ],
    });
    expect(err).toBeNull();
  });

  it('detects when dialog overflows 720p viewport bottom', () => {
    const err = detectDialogStickyFooterClipping({
      viewportHeight: 720,
      dialogs: [
        {
          top: 20,
          bottom: 768,
          stickyFooters: [],
          protectedBlocks: [],
        },
      ],
    });
    expect(err).toContain('720');
  });

  it('detects when sticky footer clips or overlaps an alert/warning note box (#740 regression guard)', () => {
    const err = detectDialogStickyFooterClipping({
      viewportHeight: 720,
      dialogs: [
        {
          top: 37,
          bottom: 696,
          stickyFooters: [{ top: 624, bottom: 696 }],
          protectedBlocks: [{ label: '送出後不能修改', top: 614, bottom: 668 }],
        },
      ],
    });
    expect(err).toContain('送出後不能修改');
  });

  it('allows scrollable long forms when remaining scroll clears the sticky footer', () => {
    const okErr = detectDialogStickyFooterClipping({
      viewportHeight: 720,
      dialogs: [
        {
          top: 37,
          bottom: 696,
          stickyFooters: [{ top: 624, bottom: 696 }],
          protectedBlocks: [
            {
              label: '可捲動說明區塊',
              top: 614,
              bottom: 668,
              canScrollAboveFooter: true,
            },
          ],
        },
      ],
    });
    expect(okErr).toBeNull();
  });
});
