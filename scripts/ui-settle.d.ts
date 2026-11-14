import type { Page } from '@playwright/test';

export const DEFAULT_SETTLE_TIMEOUT_MS = 6000;

export interface LockLightModeOptions {
  preserveMotionStyles?: boolean;
}

export interface WaitForUiSettledOptions {
  waitForSelector?: string;
  networkIdleTimeoutMs?: number;
  skeletonTimeoutMs?: number;
  settleDelayMs?: number;
  preserveMotionStyles?: boolean;
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

export interface AssertNoDialogClippingOptions {
  allowClipping?: boolean;
}

export function lockLightModeAndReducedMotion(
  page: Page,
  options?: LockLightModeOptions
): Promise<void>;

export function waitForUiSettled(
  page: Page,
  options?: WaitForUiSettledOptions
): Promise<void>;

export function collectDialogClippingSnapshot(): DialogClippingSnapshot;

export function detectDialogStickyFooterClipping(
  snapshot: DialogClippingSnapshot
): string | null;

export function assertNoDialogClipping(
  page: Page,
  contextLabel: string,
  options?: AssertNoDialogClippingOptions
): Promise<void>;
