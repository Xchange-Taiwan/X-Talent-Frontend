// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collectDialogClippingSnapshot,
  detectDialogStickyFooterClipping,
} from '../e2e/helpers/evidence.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('collectDialogClippingSnapshot computes remaining scroll clearance, detects unscrollable overlaps, and ignores notices inside sticky footer', () => {
    function makeEl({
      rect,
      style = {},
      text = '',
      scrollHeight = 0,
      clientHeight = 0,
      scrollTop = 0,
      children = [],
    }) {
      const node = {
        textContent: text,
        scrollHeight,
        clientHeight,
        scrollTop,
        parentElement: null,
        _style: {
          display: 'block',
          visibility: 'visible',
          opacity: '1',
          position: 'static',
          overflowY: 'visible',
          ...style,
        },
        getBoundingClientRect: () => ({
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width ?? 500,
          height: rect.bottom - rect.top,
        }),
        contains(other) {
          if (other === node) return true;
          return children.some((c) => c.contains(other));
        },
        querySelectorAll(sel) {
          const all = [];
          const walk = (arr) => {
            for (const ch of arr) {
              all.push(ch);
              walk(ch._children);
            }
          };
          walk(children);
          if (sel === '*') return all;
          return all.filter((x) => x._role === 'note');
        },
        _children: children,
        _role: '',
      };
      for (const ch of children) {
        ch.parentElement = node;
      }
      return node;
    }

    const innerFooterNote = makeEl({
      rect: { top: 635, bottom: 660 },
      text: 'Footer 內部提示',
    });
    innerFooterNote._role = 'note';

    const stickyFooter = makeEl({
      rect: { top: 624, bottom: 696 },
      style: { position: 'sticky' },
      children: [innerFooterNote],
    });

    const scrollableWarn = makeEl({
      rect: { top: 614, bottom: 668 },
      text: '送出後不能修改',
    });
    scrollableWarn._role = 'note';

    const scrollBody = makeEl({
      rect: { top: 80, bottom: 696 },
      style: { overflowY: 'auto' },
      scrollHeight: 800,
      clientHeight: 616,
      scrollTop: 0,
      children: [scrollableWarn, stickyFooter],
    });

    const dlg = makeEl({
      rect: { top: 37, bottom: 696 },
      children: [scrollBody],
    });

    vi.stubGlobal('window', {
      innerHeight: 720,
      getComputedStyle: (el) => el._style,
    });
    vi.stubGlobal('document', {
      querySelectorAll: () => [dlg],
    });

    // Case 1: scrollTop=0 -> remaining scroll (184px) clears sticky footer (668 - 184 <= 626) -> allowed!
    const snapCanScroll = collectDialogClippingSnapshot();
    expect(snapCanScroll.dialogs[0].protectedBlocks).toHaveLength(1);
    expect(
      snapCanScroll.dialogs[0].protectedBlocks[0].canScrollAboveFooter
    ).toBe(true);
    expect(detectDialogStickyFooterClipping(snapCanScroll)).toBeNull();

    // Case 2: already scrolled to bottom (scrollTop=184) and STILL overlapped -> caught!
    scrollBody.scrollTop = 184;
    const snapClipped = collectDialogClippingSnapshot();
    expect(snapClipped.dialogs[0].protectedBlocks[0].canScrollAboveFooter).toBe(
      false
    );
    expect(detectDialogStickyFooterClipping(snapClipped)).toContain(
      '送出後不能修改'
    );
  });
});
