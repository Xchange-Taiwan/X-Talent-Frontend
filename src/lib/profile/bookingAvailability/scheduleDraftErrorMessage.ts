import type { UpdateDraftSlotResult } from './types';

/**
 * Maps a failed `UpdateDraftSlotResult['reason']` from `MonthDraftStore.edit`
 * to its canonical user-facing destructive toast message.
 */
export function resolveScheduleDraftErrorMessage(
  reason?: UpdateDraftSlotResult['reason']
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
