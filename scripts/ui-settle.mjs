/**
 * Shared Playwright UI stabilization and 720p Dialog clipping gate for
 * Cloud UI Evidence, interactive Playwright E2E evidence, and Design Hub capture.
 *
 * Prevents the three classic headless screenshot defects:
 * 1. Capturing before Next.js Suspense / React Query skeletons finish hydrating.
 * 2. Capturing mid-animation on Radix Popover / Dialog / Tabs or before Floating UI positions portals.
 * 3. Capturing before Google WebFonts (Noto Sans TC) or visible <img> elements finish decoding.
 */

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('./ui-settle').LockLightModeOptions} LockLightModeOptions
 * @typedef {import('./ui-settle').WaitForUiSettledOptions} WaitForUiSettledOptions
 * @typedef {import('./ui-settle').DialogClippingSnapshot} DialogClippingSnapshot
 * @typedef {import('./ui-settle').AssertNoDialogClippingOptions} AssertNoDialogClippingOptions
 */

export const DEFAULT_SETTLE_TIMEOUT_MS = 6000;

/**
 * @param {Page} page
 * @param {LockLightModeOptions} [options]
 * @returns {Promise<void>}
 */
export async function lockLightModeAndReducedMotion(
  page,
  { preserveMotionStyles = false } = {}
) {
  try {
    await page.emulateMedia(
      preserveMotionStyles
        ? { colorScheme: 'light' }
        : { colorScheme: 'light', reducedMotion: 'reduce' }
    );
  } catch {
    // Ignore if page context does not support emulateMedia
  }

  try {
    await page.evaluate(() => {
      if (!document.querySelector('meta[name="darkreader-lock"]')) {
        const lock = document.createElement('meta');
        lock.name = 'darkreader-lock';
        document.head?.appendChild(lock);
      }
      if (!document.querySelector('meta[name="color-scheme"]')) {
        const scheme = document.createElement('meta');
        scheme.name = 'color-scheme';
        scheme.content = 'light';
        document.head?.appendChild(scheme);
      }
      if (document.documentElement) {
        document.documentElement.style.colorScheme = 'light';
      }
      if (!document.querySelector('style[data-clean-dev-overlay]')) {
        const cleanStyle = document.createElement('style');
        cleanStyle.setAttribute('data-clean-dev-overlay', 'true');
        cleanStyle.textContent =
          'nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }';
        document.head?.appendChild(cleanStyle);
      }
    });
  } catch {
    // Ignore if navigation is still in progress
  }
}

/**
 * @param {Page} page
 * @param {WaitForUiSettledOptions} [options]
 * @returns {Promise<void>}
 */
export async function waitForUiSettled(page, options = {}) {
  const {
    waitForSelector = '',
    networkIdleTimeoutMs = 4000,
    skeletonTimeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
    settleDelayMs = 250,
    preserveMotionStyles = false,
  } = options;

  await lockLightModeAndReducedMotion(page, { preserveMotionStyles });

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  } catch {
    // Continue best-effort
  }

  try {
    await page.waitForLoadState('networkidle', {
      timeout: networkIdleTimeoutMs,
    });
  } catch {
    // Long-lived connections or background polling may prevent strict networkidle
  }

  if (waitForSelector) {
    await page
      .locator(waitForSelector)
      .first()
      .waitFor({ state: 'visible', timeout: 12000 });
  }

  // Wait for transient skeletons, spinners, and "載入中..." placeholders to clear
  try {
    await page.waitForFunction(
      () => {
        const isVisible = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0
          ) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const busySelectors = [
          '[aria-busy="true"]',
          '[data-testid*="skeleton" i]',
          '[data-testid*="loading" i]',
          '[class*="skeleton" i]',
        ];
        for (const sel of busySelectors) {
          const matches = Array.from(document.querySelectorAll(sel));
          if (matches.some(isVisible)) return false;
        }

        const loadingTexts = new Set(['載入中...', '載入中', 'loading...']);
        const candidates = Array.from(
          document.querySelectorAll('p, span, div')
        );
        for (const el of candidates) {
          if (el.children.length > 0) continue;
          const txt = (el.textContent || '').trim().toLowerCase();
          if (loadingTexts.has(txt) && isVisible(el)) {
            return false;
          }
        }
        return true;
      },
      { timeout: skeletonTimeoutMs }
    );
  } catch {
    // Proceed if page intentionally retains a decorative indicator
  }

  // Wait for WebFonts (e.g. Noto Sans TC / Open Sans) and visible images to decode
  try {
    await page.evaluate(async () => {
      const withTimeout = (promise, ms) =>
        Promise.race([
          promise,
          new Promise((resolve) => setTimeout(resolve, ms)),
        ]);

      if (document.fonts?.ready) {
        await withTimeout(document.fonts.ready, 5000);
      }

      const imgs = Array.from(document.querySelectorAll('img')).filter(
        (img) => {
          const rect = img.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom >= 0 &&
            rect.top <= window.innerHeight * 1.5
          );
        }
      );

      await withTimeout(
        Promise.all(
          imgs.map(async (img) => {
            try {
              if (img.loading === 'lazy') {
                img.loading = 'eager';
              }
              if (!img.complete) {
                await new Promise((resolve) => {
                  img.addEventListener('load', resolve, { once: true });
                  img.addEventListener('error', resolve, { once: true });
                });
              }
              if (typeof img.decode === 'function') {
                await img.decode().catch(() => {});
              }
            } catch {
              // Ignore broken mock image URLs
            }
          })
        ),
        5000
      );

      const finiteAnims = (
        typeof document.getAnimations === 'function'
          ? document.getAnimations()
          : []
      ).filter((anim) => {
        const timing = anim.effect?.getComputedTiming?.();
        const iterations = timing?.iterations ?? 1;
        const duration = Number(timing?.duration ?? 0);
        return (
          iterations !== Infinity &&
          Number.isFinite(duration) &&
          duration > 0 &&
          duration <= 2000
        );
      });
      if (finiteAnims.length > 0) {
        await withTimeout(
          Promise.allSettled(finiteAnims.map((a) => a.finished)),
          2100
        );
      }

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
    });
  } catch {
    // Ignore if execution context navigated
  }

  await lockLightModeAndReducedMotion(page, { preserveMotionStyles });

  if (settleDelayMs > 0) {
    await page.waitForTimeout(settleDelayMs);
  }
}

/**
 * Pure geometry check catching 720p Dialog viewport overflow and sticky-footer
 * occlusion of warning/note callouts (e.g. #740 Mentor step-2 warning box).
 *
 * @param {DialogClippingSnapshot} snapshot
 * @returns {string | null}
 */
export function detectDialogStickyFooterClipping(snapshot) {
  const { viewportHeight, dialogs } = snapshot || {};
  if (!viewportHeight || !Array.isArray(dialogs)) return null;

  for (const dlg of dialogs) {
    if (dlg.top < -2 || dlg.bottom > viewportHeight + 2) {
      return `Dialog overflows ${viewportHeight}px viewport (top=${Math.round(dlg.top)}, bottom=${Math.round(dlg.bottom)}). Ensure max-h fits viewport with internal scroll.`;
    }
    for (const footer of dlg.stickyFooters || []) {
      for (const block of dlg.protectedBlocks || []) {
        if (block.canScrollAboveFooter) continue;
        const overlaps =
          block.bottom > footer.top + 2 && block.top < footer.bottom - 2;
        if (overlaps) {
          return `Dialog sticky footer (top=${Math.round(footer.top)}) clips/overlaps notice '${block.label}' (top=${Math.round(block.top)}, bottom=${Math.round(block.bottom)}). Move notice into shrink-0 region above footer or adjust spacing.`;
        }
      }
    }
  }
  return null;
}

/**
 * Browser-side DOM measurement function passed to `page.evaluate(...)` to
 * inspect open `[role="dialog"]` / `[role="alertdialog"]` geometry, sticky
 * footers, and scrollable clearance of warning/note callouts.
 *
 * @returns {DialogClippingSnapshot}
 */
export function collectDialogClippingSnapshot() {
  const isVis = (el) => {
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      return false;
    }
    const s = window.getComputedStyle(el);
    if (
      s.display === 'none' ||
      s.visibility === 'hidden' ||
      Number(s.opacity) === 0
    ) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const dialogs = Array.from(
    document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
  )
    .filter(isVis)
    .map((dlg) => {
      const dr = dlg.getBoundingClientRect();
      const dlgHeight = dr.bottom - dr.top;
      const footerEls = Array.from(dlg.querySelectorAll('*')).filter((el) => {
        if (!isVis(el)) return false;
        const pos = window.getComputedStyle(el).position;
        if (pos !== 'sticky' && pos !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return (
          dlgHeight > 80 &&
          r.bottom >= dr.bottom - 32 &&
          r.top >= dr.top + dlgHeight * 0.45
        );
      });
      const stickyFooters = footerEls.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      });
      const minFooterTop =
        stickyFooters.length > 0
          ? Math.min(...stickyFooters.map((f) => f.top))
          : Infinity;

      const protectedBlocks = Array.from(
        dlg.querySelectorAll(
          '[role="note"], [role="alert"], [data-testid*="warning" i]'
        )
      )
        .filter((el) => isVis(el) && !footerEls.some((fEl) => fEl.contains(el)))
        .flatMap((el) => {
          const rawRect = el.getBoundingClientRect();
          let visTop = rawRect.top;
          let visBottom = rawRect.bottom;
          let maxRemainingScroll = 0;

          let cur = el.parentElement;
          while (cur && dlg.contains(cur)) {
            const oy = window.getComputedStyle(cur).overflowY;
            if (oy !== 'visible') {
              const containsFooter = footerEls.some((fEl) => cur.contains(fEl));
              if (!containsFooter) {
                const cr = cur.getBoundingClientRect();
                visTop = Math.max(visTop, cr.top);
                visBottom = Math.min(visBottom, cr.bottom);
              }
              if (
                (oy === 'auto' || oy === 'scroll') &&
                cur.scrollHeight > cur.clientHeight + 4
              ) {
                const rem = Math.max(
                  0,
                  cur.scrollHeight - cur.clientHeight - cur.scrollTop
                );
                maxRemainingScroll = Math.max(maxRemainingScroll, rem);
              }
            }
            if (cur === dlg) break;
            cur = cur.parentElement;
          }

          if (visBottom - visTop <= 2) return [];
          const canScrollAboveFooter =
            maxRemainingScroll > 0 &&
            rawRect.bottom - maxRemainingScroll <= minFooterTop + 2;

          const label = (el.textContent || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 36);
          return [
            {
              label: label || 'notice',
              top: visTop,
              bottom: visBottom,
              canScrollAboveFooter,
            },
          ];
        });
      return {
        top: dr.top,
        bottom: dr.bottom,
        stickyFooters,
        protectedBlocks,
      };
    });
  return { viewportHeight: window.innerHeight, dialogs };
}

/**
 * Evaluates the shared 720p Dialog & Sticky Footer clipping check against a live
 * Playwright Page and throws a descriptive error unless `allowClipping` is set.
 *
 * @param {Page} page
 * @param {string} contextLabel
 * @param {AssertNoDialogClippingOptions} [options]
 * @returns {Promise<void>}
 */
export async function assertNoDialogClipping(
  page,
  contextLabel,
  { allowClipping = false } = {}
) {
  if (allowClipping) return;

  const clipSnapshot = await page
    .evaluate(collectDialogClippingSnapshot)
    .catch(() => null);

  if (clipSnapshot) {
    const clipErr = detectDialogStickyFooterClipping(clipSnapshot);
    if (clipErr) {
      throw new Error(`[${contextLabel}] ${clipErr}`);
    }
  }
}
