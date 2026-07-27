export interface ComputeOverflowFitParams {
  itemWidths: number[];
  containerWidth: number | null;
  gapPx: number;
  reservePx?: number;
  defaultVisibleCount?: number;
}

export interface ComputeOverflowFitResult {
  visibleCount: number;
  isMeasuring: boolean;
}

/**
 * Pure calculation function for overflow fit.
 * Given item widths, container width, gaps, and reserved space,
 * calculates how many items can fit.
 */
export function computeOverflowFit({
  itemWidths,
  containerWidth,
  gapPx,
  reservePx = 0,
  defaultVisibleCount,
}: ComputeOverflowFitParams): ComputeOverflowFitResult {
  const isMeasuring =
    containerWidth === null ||
    itemWidths.length === 0 ||
    itemWidths.every((w) => w === 0);

  if (isMeasuring) {
    return {
      visibleCount: defaultVisibleCount ?? itemWidths.length,
      isMeasuring: true,
    };
  }

  let total = reservePx;
  let lastIndex = itemWidths.length - 1;

  for (let i = 0; i < itemWidths.length; i++) {
    const gap = i > 0 ? gapPx : 0;
    total += itemWidths[i] + gap;
    if (total > containerWidth!) {
      lastIndex = i - 1;
      break;
    }
  }

  const visibleCount = Math.max(0, Math.min(lastIndex + 1, itemWidths.length));

  return {
    visibleCount,
    isMeasuring: false,
  };
}
