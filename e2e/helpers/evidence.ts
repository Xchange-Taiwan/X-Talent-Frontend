import type { Locator, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import type {
  DialogClippingSnapshot,
  WaitForUiSettledOptions,
} from '../../scripts/ui-settle';
import {
  assertNoDialogClipping,
  collectDialogClippingSnapshot,
  detectDialogStickyFooterClipping,
  waitForUiSettled,
} from '../../scripts/ui-settle.mjs';

export {
  assertNoDialogClipping,
  collectDialogClippingSnapshot,
  detectDialogStickyFooterClipping,
  type DialogClippingSnapshot,
  type WaitForUiSettledOptions,
};

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
  /** Preserve CSS motion styles instead of forcing reducedMotion: 'reduce'. */
  preserveMotionStyles?: boolean;
  /** Opt out of automatic 720p Dialog & Sticky Footer clipping check when intentionally testing overflow. */
  allowClipping?: boolean;
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
 * Delegates page stabilization (Light Mode lock, dev-overlay suppression,
 * hydration/skeleton clearance, WebFont & image decode, finite animation settle)
 * to the single source of truth in `scripts/ui-settle.mjs`.
 */
export async function waitForPageSettled(
  page: Page,
  options: WaitForUiSettledOptions = {}
): Promise<void> {
  await waitForUiSettled(page, options);
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
    preserveMotionStyles: options.preserveMotionStyles,
  });

  await assertNoDialogClipping(page, `captureEvidence:${name}`, {
    allowClipping: options.allowClipping,
  });

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
