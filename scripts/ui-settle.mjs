/**
 * Shared Playwright UI stabilization helper for Cloud UI Evidence & Design Hub capture.
 *
 * Prevents the three classic headless screenshot defects:
 * 1. Capturing before Next.js Suspense / React Query skeletons finish hydrating.
 * 2. Capturing mid-animation on Radix Popover / Dialog / Tabs or before Floating UI positions portals.
 * 3. Capturing before Google WebFonts (Noto Sans TC) or visible <img> elements finish decoding.
 */

export const DEFAULT_SETTLE_TIMEOUT_MS = 6000;

export async function lockLightModeAndReducedMotion(page) {
  try {
    await page.emulateMedia({
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
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

export async function waitForUiSettled(page, options = {}) {
  const {
    waitForSelector = '',
    networkIdleTimeoutMs = 4000,
    skeletonTimeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
    settleDelayMs = 250,
  } = options;

  await lockLightModeAndReducedMotion(page);

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

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
    });
  } catch {
    // Ignore if execution context navigated
  }

  await lockLightModeAndReducedMotion(page);

  if (settleDelayMs > 0) {
    await page.waitForTimeout(settleDelayMs);
  }
}
