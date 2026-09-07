'use client';

import { useEffect, useState } from 'react';

/**
 * 軟鍵盤造成的視窗遮蔽量測結果。
 */
export interface KeyboardInset {
  /**
   * layout viewport 底部被瀏覽器 widget（實務上就是軟鍵盤）蓋住的高度，單位 px。
   */
  inset: number;

  /**
   * 目前 visual viewport 的高度，單位 px。尚未量測到時為 0。
   */
  viewportHeight: number;
}

const EMPTY: KeyboardInset = { inset: 0, viewportHeight: 0 };

/**
 * 追蹤軟鍵盤佔掉的畫面高度。
 *
 * `position: fixed` 的元素是相對 layout viewport 排版的，而 Android Chrome
 * （預設 `interactive-widget=resizes-visual`）與 iOS Safari 在鍵盤升起時都只縮
 * visual viewport、不動 layout viewport。因此貼齊底部的面板會整個躲到鍵盤後面，
 * 必須自行把它往上抬這段距離。
 *
 * @param enabled 是否要進行量測。面板關閉時傳 false 可省下事件監聽。
 */
export function useKeyboardInset(enabled: boolean): KeyboardInset {
  const [metrics, setMetrics] = useState<KeyboardInset>(EMPTY);

  useEffect(() => {
    const viewport =
      typeof window === 'undefined' ? null : window.visualViewport;

    if (!enabled || !viewport) {
      setMetrics(EMPTY);
      return;
    }

    const read = (): void => {
      setMetrics({
        inset: Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop
        ),
        viewportHeight: viewport.height,
      });
    };

    read();

    // iOS 在鍵盤升起後捲動會改變 offsetTop，所以 scroll 也要聽，不是只有 resize。
    viewport.addEventListener('resize', read);
    viewport.addEventListener('scroll', read);

    return () => {
      viewport.removeEventListener('resize', read);
      viewport.removeEventListener('scroll', read);
    };
  }, [enabled]);

  return metrics;
}
