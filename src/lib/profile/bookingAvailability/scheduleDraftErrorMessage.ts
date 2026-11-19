import { parseMonthKey } from '@/lib/profile/scheduleHelpers';

import type {
  AddDraftSlotFailureReason,
  MonthKey,
  SyncResult,
  UpdateDraftSlotFailureReason,
} from './types';

export type ScheduleDraftErrorContext =
  | {
      kind: 'add';
      reason?: AddDraftSlotFailureReason;
    }
  | {
      kind: 'edit';
      reason?: UpdateDraftSlotFailureReason;
    }
  | {
      kind: 'sync';
      result?: Extract<SyncResult, { ok: false }>;
      viewedMonthKey?: MonthKey;
    };

function formatMonthLabel(monthKey: MonthKey): string {
  const { month } = parseMonthKey(monthKey);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? `${month} 月`
    : monthKey;
}

function resolveAddSlotErrorMessage(
  reason?: AddDraftSlotFailureReason
): string {
  switch (reason) {
    case 'OVERLAP':
      return '此時段與其他時段重疊';
    case 'NO_DATE_SELECTED':
      return '請先選擇日期後再新增時段';
    case 'INVALID_INPUT':
    default:
      return '新增時段失敗，請確認時間設定後再試。';
  }
}

function resolveEditSlotErrorMessage(
  reason?: UpdateDraftSlotFailureReason
): string {
  switch (reason) {
    case 'TARGET_MONTH_NOT_LOADED':
      return '目標月份排程尚未載入，請先在行事曆中切換至目標月份。';
    case 'OVERLAP':
      return '此時段與其他時段重疊';
    case 'READ_ONLY':
      return '此時段已被預約引用，無法編輯，請改為新增新時段';
    default:
      return '更新時段失敗，發生未知的錯誤，請稍後再試。';
  }
}

function resolveSyncScheduleErrorMessage(
  result?: Extract<SyncResult, { ok: false }>,
  viewedMonthKey?: MonthKey
): string {
  if (!result) {
    return '儲存失敗,請稍後再試';
  }

  const baseMessage =
    result.reason === 'conflict'
      ? '此時段與既有預約衝突,請新增新時段後再試'
      : '儲存失敗,請稍後再試';

  const { committedMonthKeys, failedMonthKey } = result;

  if (committedMonthKeys.length > 0) {
    const committedLabel = committedMonthKeys.map(formatMonthLabel).join('、');
    const failedLabel = formatMonthLabel(failedMonthKey);
    return `已儲存 ${committedLabel}，但 ${failedLabel}${baseMessage}`;
  }

  if (failedMonthKey && viewedMonthKey && failedMonthKey !== viewedMonthKey) {
    return `${formatMonthLabel(failedMonthKey)}${baseMessage}`;
  }

  return baseMessage;
}

/**
 * Unified error-copy resolver for mentor schedule draft mutations (`add`,
 * `edit`) and multi-month schedule persistence (`sync`).
 */
export function resolveScheduleDraftErrorMessage(
  context: ScheduleDraftErrorContext
): string {
  switch (context.kind) {
    case 'add':
      return resolveAddSlotErrorMessage(context.reason);
    case 'edit':
      return resolveEditSlotErrorMessage(context.reason);
    case 'sync':
      return resolveSyncScheduleErrorMessage(
        context.result,
        context.viewedMonthKey
      );
  }
}
