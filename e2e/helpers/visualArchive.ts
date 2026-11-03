import { Locator, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type ArchiveModuleId =
  | 'module-1'
  | 'module-2'
  | 'module-3'
  | 'module-4'
  | 'module-5'
  | 'module-6'
  | 'module-7';

export type ArchiveViewportKey = 'desktop' | 'mobile';

export const ARCHIVE_VIEWPORTS: Record<
  ArchiveViewportKey,
  { width: number; height: number }
> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/**
 * Default selectors for dynamic timestamps and countdown badges that change
 * between test runs and would otherwise trigger false-positive pixel diffs
 * in reg-cli visual regression comparisons.
 */
export const DEFAULT_DYNAMIC_MASK_SELECTORS: readonly string[] = [
  '[data-testid="reservation-countdown"]',
  '[data-testid="notification-timestamp"]',
  'time',
  '.rdp-day_today',
];

const STABILIZE_VISUAL_ARCHIVE_CSS = `
  *, *::before, *::after {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

export interface CaptureArchiveOptions {
  runId?: string;
  outRootDir?: string;
  viewport?: ArchiveViewportKey;
  maskSelectors?: readonly string[];
  includeDefaultMasks?: boolean;
  fullPage?: boolean;
}

export function resolveArchiveOutputPath(
  moduleId: ArchiveModuleId,
  screenId: string,
  options: Pick<CaptureArchiveOptions, 'runId' | 'outRootDir'> = {}
): string {
  const runId =
    options.runId?.trim() ||
    process.env.QA_ARCHIVE_RUN_ID?.trim() ||
    'latest-e2e-run';
  const outRootDir =
    options.outRootDir?.trim() ||
    process.env.QA_ARCHIVE_OUT_DIR?.trim() ||
    'qa-archive-runs';
  const normalizedScreen = screenId.replace(/\.png$/i, '');
  return path.resolve(outRootDir, runId, moduleId, `${normalizedScreen}.png`);
}

export async function stabilizePageForVisualArchive(
  page: Page,
  viewport: ArchiveViewportKey = 'desktop'
): Promise<void> {
  await page.setViewportSize(ARCHIVE_VIEWPORTS[viewport]);
  await page.addStyleTag({ content: STABILIZE_VISUAL_ARCHIVE_CSS });
  await page.evaluate(async () => {
    if ('fonts' in document) {
      await document.fonts.ready;
    }
  });
}

export async function captureArchiveScreenshot(
  page: Page,
  moduleId: ArchiveModuleId,
  screenId: string,
  options: CaptureArchiveOptions = {}
): Promise<string> {
  const viewport = options.viewport ?? 'desktop';
  await stabilizePageForVisualArchive(page, viewport);

  const selectors = [
    ...(options.includeDefaultMasks === false
      ? []
      : DEFAULT_DYNAMIC_MASK_SELECTORS),
    ...(options.maskSelectors ?? []),
  ];

  const mask: Locator[] = selectors.map((sel) => page.locator(sel));
  const outputPath = resolveArchiveOutputPath(moduleId, screenId, options);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await page.screenshot({
    path: outputPath,
    fullPage: options.fullPage ?? false,
    animations: 'disabled',
    mask,
  });

  return outputPath;
}
