import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useOverflowFit } from './useOverflowFit';

describe('useOverflowFit', () => {
  it('returns isMeasuring: true and defaultVisibleCount if provided when containerWidth is null', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [10, 20, 30],
        containerWidth: null,
        gapPx: 8,
        defaultVisibleCount: 2,
      })
    );
    expect(result.current.isMeasuring).toBe(true);
    expect(result.current.visibleCount).toBe(2);
  });

  it('returns isMeasuring: true and full length if defaultVisibleCount is not provided when containerWidth is null', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [10, 20, 30],
        containerWidth: null,
        gapPx: 8,
      })
    );
    expect(result.current.isMeasuring).toBe(true);
    expect(result.current.visibleCount).toBe(3);
  });

  it('returns isMeasuring: true and defaultVisibleCount if provided when itemWidths is empty', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [],
        containerWidth: 100,
        gapPx: 8,
        defaultVisibleCount: 5,
      })
    );
    expect(result.current.isMeasuring).toBe(true);
    expect(result.current.visibleCount).toBe(5);
  });

  it('returns isMeasuring: true when itemWidths is empty and no defaultVisibleCount', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [],
        containerWidth: 100,
        gapPx: 8,
      })
    );
    expect(result.current.isMeasuring).toBe(true);
    expect(result.current.visibleCount).toBe(0);
  });

  it('returns isMeasuring: true and defaultVisibleCount if provided when all itemWidths are 0', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [0, 0, 0],
        containerWidth: 100,
        gapPx: 8,
        defaultVisibleCount: 1,
      })
    );
    expect(result.current.isMeasuring).toBe(true);
    expect(result.current.visibleCount).toBe(1);
  });

  it('calculates visibleCount when all items fit', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [20, 30, 40], // total 20+30+40 + 8*2 = 106
        containerWidth: 120,
        gapPx: 8,
      })
    );
    expect(result.current.isMeasuring).toBe(false);
    expect(result.current.visibleCount).toBe(3);
  });

  it('calculates visibleCount when some items are truncated (no reservePx)', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [20, 30, 40], // 1st: 20 (fits); 2nd: 20+30+8=58 (fits); 3rd: 58+40+8=106 (exceeds)
        containerWidth: 80,
        gapPx: 8,
      })
    );
    expect(result.current.isMeasuring).toBe(false);
    expect(result.current.visibleCount).toBe(2);
  });

  it('calculates visibleCount with reservePx for extra badge', () => {
    // reservePx = 52.
    // 1st item: 52 + 20 = 72. (fits in 80)
    // 2nd item: 72 + 30 + 8 = 110. (exceeds 80)
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [20, 30, 40],
        containerWidth: 80,
        gapPx: 8,
        reservePx: 52,
      })
    );
    expect(result.current.isMeasuring).toBe(false);
    expect(result.current.visibleCount).toBe(1);
  });

  it('returns 0 when even the first item plus reservePx exceeds containerWidth', () => {
    const { result } = renderHook(() =>
      useOverflowFit({
        itemWidths: [50],
        containerWidth: 80,
        gapPx: 8,
        reservePx: 40, // 50 + 40 = 90 > 80
      })
    );
    expect(result.current.isMeasuring).toBe(false);
    expect(result.current.visibleCount).toBe(0);
  });
});
