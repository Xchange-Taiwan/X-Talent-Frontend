export interface UseOverflowFitParams {
  itemWidths: number[];
  containerWidth: number | null;
  gapPx: number;
  reservePx?: number;
  defaultVisibleCount?: number;
}

export interface UseOverflowFitResult {
  visibleCount: number;
  isMeasuring: boolean;
}

/**
 * Pure calculation function for overflow fit.
 * Does not depend on React rendering cycle or trigger React state updates itself.
 */
export function computeOverflowFit({
  itemWidths,
  containerWidth,
  gapPx,
  reservePx = 0,
  defaultVisibleCount,
}: UseOverflowFitParams): UseOverflowFitResult {
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

/**
 * Custom React Hook that wraps computeOverflowFit for easy use in rendering path.
 */
export function useOverflowFit(
  params: UseOverflowFitParams
): UseOverflowFitResult {
  return computeOverflowFit(params);
}
