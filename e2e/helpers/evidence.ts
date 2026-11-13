import type { Locator, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export interface CaptureEvidenceOptions {
  /** Optional specific Locator to screenshot instead of the viewport/page. */
  locator?: Locator;
  /** Optional selector that MUST be visible before capturing (e.g. '[role="dialog"]'). */
  waitForSelector?: string;
  /** Capture full scrollable page instead of current viewport. Defaults to false so popovers/modals stay crisp at 1:1 scale. */
  fullPage?: boolean;
  /** Force capture even when CAPTURE_EVIDENCE env var is not set. */
  force?: boolean;
  /** Custom output directory (defaults to EVIDENCE_OUT_DIR or '.agents/tmp/evidence'). */
  outDir?: string;
  /** Extra settle wait in milliseconds after fonts/images/skeletons settle (default 250). */
  settleDelayMs?: number;
  /** Opt out of automatic 720p Dialog & Sticky Footer clipping check when intentionally testing overflow. */
  allowClipping?: boolean;
}

export interface DialogClippingSnapshot {
  viewportHeight: number;
  dialogs: Array<{
    top: number;
    bottom: number;
    stickyFooters: Array<{ top: number; bottom: number }>;
    protectedBlocks: Array<{
      label: string;
      top: number;
      bottom: number;
      canScrollAboveFooter?: boolean;
    }>;
  }>;
}

/**
 * Pure geometry check catching 720p Dialog viewport overflow and sticky-footer
 * occlusion of warning/note callouts (e.g. #740 Mentor step-2 warning box).
 */
export function detectDialogStickyFooterClipping(
  snapshot: DialogClippingSnapshot
): string | null {
  const { viewportHeight, dialogs } = snapshot;
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

export function isEvidenceCaptureEnabled(force = false): boolean {
  if (force) return true;
  const raw = String(process.env.CAPTURE_EVIDENCE ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function sanitizeEvidenceName(name: string): string {
  const cleaned = String(name ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'ui-evidence';
}

/**
 * Waits until Next.js hydration, loading skeletons, web fonts, visible images,
 * and Radix Popover/Dialog portal positioning have completely settled in Light Mode.
 */
export async function waitForPageSettled(
  page: Page,
  options: { waitForSelector?: string; settleDelayMs?: number } = {}
): Promise<void> {
  const { waitForSelector, settleDelayMs = 250 } = options;

  try {
    await page.emulateMedia({
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
  } catch {
    // Ignore if unsupported by browser context
  }

  try {
    await page.evaluate(() => {
      if (!document.querySelector('meta[name="darkreader-lock"]')) {
        const lock = document.createElement('meta');
        lock.name = 'darkreader-lock';
        document.head?.appendChild(lock);
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
    // Ignore transient navigation context errors
  }

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
  } catch {
    // Continue best-effort
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 4_000 });
  } catch {
    // Polling or mocked streams may keep network busy
  }

  if (waitForSelector) {
    await page
      .locator(waitForSelector)
      .first()
      .waitFor({ state: 'visible', timeout: 12_000 });
  }

  try {
    await page.waitForFunction(
      () => {
        const isVisible = (el: Element): boolean => {
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
          if (Array.from(document.querySelectorAll(sel)).some(isVisible)) {
            return false;
          }
        }

        const loadingLabels = new Set(['載入中...', '載入中', 'loading...']);
        for (const el of Array.from(
          document.querySelectorAll('p, span, div')
        )) {
          if (el.children.length > 0) continue;
          const txt = (el.textContent ?? '').trim().toLowerCase();
          if (loadingLabels.has(txt) && isVisible(el)) {
            return false;
          }
        }
        return true;
      },
      { timeout: 6_000 }
    );
  } catch {
    // Continue if an intentional indicator stays visible
  }

  try {
    await page.evaluate(async () => {
      const withTimeout = <T>(promise: Promise<T>, ms: number) =>
        Promise.race([
          promise,
          new Promise<void>((resolve) => setTimeout(resolve, ms)),
        ]);

      if (document.fonts?.ready) {
        await withTimeout(document.fonts.ready, 5_000);
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
                await new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), {
                    once: true,
                  });
                });
              }
              if (typeof img.decode === 'function') {
                await img.decode().catch(() => undefined);
              }
            } catch {
              // Ignore mocked placeholder avatar failures
            }
          })
        ),
        5_000
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
          1_500
        );
      }

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    });
  } catch {
    // Ignore context reload
  }

  if (settleDelayMs > 0) {
    await page.waitForTimeout(settleDelayMs);
  }
}

/**
 * Captures a verified, fully-settled Light Mode PR evidence screenshot inside an
 * interactive Playwright E2E test (e.g., right after opening a Notification Popover,
 * switching Tabs, or opening a Dialog).
 *
 * No-ops during ordinary local test runs unless `CAPTURE_EVIDENCE=1` or `force: true`.
 */
export async function captureEvidence(
  page: Page,
  name: string,
  options: CaptureEvidenceOptions = {}
): Promise<string | null> {
  if (!isEvidenceCaptureEnabled(options.force)) {
    return null;
  }

  const outDir =
    options.outDir || process.env.EVIDENCE_OUT_DIR || '.agents/tmp/evidence';
  fs.mkdirSync(outDir, { recursive: true });

  if (options.locator) {
    await options.locator.waitFor({ state: 'visible', timeout: 10_000 });
    await options.locator.scrollIntoViewIfNeeded().catch(() => undefined);
  }

  await waitForPageSettled(page, {
    waitForSelector: options.waitForSelector,
    settleDelayMs: options.settleDelayMs,
  });

  if (!options.allowClipping) {
    const clipSnapshot = await page
      .evaluate((): DialogClippingSnapshot => {
        const isVis = (el: Element): boolean => {
          if (!(el instanceof HTMLElement)) return false;
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
            const footerEls = Array.from(dlg.querySelectorAll('*')).filter(
              (el) => {
                if (!isVis(el)) return false;
                const pos = window.getComputedStyle(el).position;
                if (pos !== 'sticky' && pos !== 'fixed') return false;
                const r = el.getBoundingClientRect();
                return (
                  dlgHeight > 80 &&
                  r.bottom >= dr.bottom - 32 &&
                  r.top >= dr.top + dlgHeight * 0.45
                );
              }
            );
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
              .filter(
                (el) =>
                  isVis(el) && !footerEls.some((fEl) => fEl.contains(el))
              )
              .flatMap((el) => {
                const rawRect = el.getBoundingClientRect();
                let visTop = rawRect.top;
                let visBottom = rawRect.bottom;
                let maxRemainingScroll = 0;

                let cur: HTMLElement | null = el.parentElement;
                while (cur && dlg.contains(cur)) {
                  const oy = window.getComputedStyle(cur).overflowY;
                  if (oy !== 'visible') {
                    const containsFooter = footerEls.some((fEl) =>
                      cur!.contains(fEl)
                    );
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
      })
      .catch(() => null);

    if (clipSnapshot) {
      const clipErr = detectDialogStickyFooterClipping(clipSnapshot);
      if (clipErr) {
        throw new Error(`[captureEvidence:${name}] ${clipErr}`);
      }
    }
  }

  const viewportSize = page.viewportSize();
  const vpPrefix =
    viewportSize && viewportSize.width <= 480 ? 'mobile' : 'desktop';
  const baseSlug = sanitizeEvidenceName(name);
  const fileName = baseSlug.startsWith(`${vpPrefix}-`)
    ? `${baseSlug}.png`
    : `${vpPrefix}-${baseSlug}.png`;
  const filePath = path.join(outDir, fileName);

  if (options.locator) {
    await options.locator.screenshot({ path: filePath });
  } else {
    await page.screenshot({
      path: filePath,
      fullPage: Boolean(options.fullPage),
    });
  }

  return filePath;
}
