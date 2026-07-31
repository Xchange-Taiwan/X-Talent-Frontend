'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure, sanitize } from '@/lib/monitoring';

const safeSanitize = (val: string): string => {
  if (typeof sanitize !== 'function') {
    return '[Sanitization failed]';
  }
  try {
    const sanitized = sanitize(val);
    return sanitized !== undefined ? sanitized : '[Sanitization failed]';
  } catch {
    return '[Sanitization failed]';
  }
};

const EMPTY_CONFIG = {};

/**
 * Helper to resolve configuration properties which can be static values or dynamic functions.
 */
function resolveValue<TResult>(
  nested: unknown,
  flat: unknown,
  error: unknown
): TResult {
  const val = nested !== undefined ? nested : flat;
  if (typeof val === 'function') {
    return val(error) as TResult;
  }
  return val as TResult;
}

export interface AsyncActionConfig<TThrowError extends boolean = boolean> {
  /**
   * Sentry 錯誤記錄的 Flow 名稱 (例如 'profile_update', 'sign_in')
   * @deprecated 建議改用 `captureFailure.flow` 結構進行設定
   */
  flow?: string;
  /**
   * Sentry 錯誤記錄的 Step 步驟 (例如 'unexpected', 'submit')
   * @deprecated 建議改用 `captureFailure.step` 結構進行設定
   */
  step?: string | ((error: unknown) => string);
  /**
   * Sentry 錯誤記錄的 Level 層級
   * @deprecated 建議改用 `captureFailure.level` 結構進行設定
   */
  level?:
    | 'info'
    | 'warning'
    | 'error'
    | ((error: unknown) => 'info' | 'warning' | 'error' | undefined);
  /**
   * Sentry 錯誤記錄的自訂 Message
   * @deprecated 建議改用 `captureFailure.message` 結構進行設定
   */
  message?: string | ((error: unknown) => string);
  /**
   * Sentry 錯誤記錄的 Error Code
   * @deprecated 建議改用 `captureFailure.errorCode` 結構進行設定
   */
  errorCode?: string | ((error: unknown) => string | undefined);
  /**
   * 發生錯誤時顯示的 Toast 標題
   * @deprecated 建議改用 `toastOnError.title` 結構進行設定
   */
  errorTitle?: string | ((error: unknown) => string | undefined);
  /**
   * 發生錯誤時顯示的 Toast 文案。如不提供則不彈出 Toast
   * @deprecated 建議改用 `toastOnError.description` 結構進行設定
   */
  errorMessage?: string | ((error: unknown) => string | undefined);
  /**
   * Toast 顯示持續時間（微秒），預設 5000 毫秒
   * @deprecated 建議改用 `toastOnError.duration` 結構進行設定
   */
  duration?: number | ((error: unknown) => number | undefined);

  /**
   * Pluggable 錯誤回撥，提供額外的自訂處理邏輯
   */
  onError?: (error: unknown) => void;
  /**
   * 成功執行後的回撥
   */
  onSuccess?: (data: unknown) => void;
  /**
   * 是否在非同步操作失敗時重新拋出錯誤，讓呼叫端做額外處理。預設為 true。
   * 設定為 false 時將吞沒錯誤並 resolve 成 undefined。
   */
  throwError?: TThrowError;
  /**
   * 是否啟用並發防護（防連點）。預設為 true，當正在執行時直接拒絕後續呼叫。
   */
  preventConcurrent?: boolean;
  /**
   * 是否在成功執行後立刻重置 pending 狀態。預設為 true。
   * 設為 false 適用於提交成功後會有 Page Redirect 轉址的情境（轉址期間保持 pending 防止按鈕重複點擊）。
   */
  resetPendingOnSuccess?: boolean;
  /**
   * 判斷此錯誤是否已經在底層被 logging 過，避免重複上報。
   */
  shouldSkipLogging?: (error: unknown) => boolean;

  captureFailure?: {
    flow: string;
    step: string | ((error: unknown) => string);
    level?:
      | 'info'
      | 'warning'
      | 'error'
      | ((error: unknown) => 'info' | 'warning' | 'error' | undefined);
    message?: string | ((error: unknown) => string);
    errorCode?: string | ((error: unknown) => string | undefined);
  };
  toastOnError?: {
    title?: string | ((error: unknown) => string | undefined);
    description: string | ((error: unknown) => string);
    variant?: 'default' | 'destructive';
    duration?: number | ((error: unknown) => number | undefined);
  };
}

type RunReturnType<TRunThrow extends boolean, T> = TRunThrow extends false
  ? T | undefined
  : T;

/**
 * 當非同步操作正在執行中，且開啟了防連擊/並發防護時，重複點擊所拋出的專用錯誤。
 * 呼叫端與全域監控系統（如 Sentry）可輕易識別此型別並進行過濾/靜默處理，避免垃圾日誌。
 */
export class ConcurrentActionError extends Error {
  constructor() {
    super('Action is already pending');
    this.name = 'ConcurrentActionError';
    Object.setPrototypeOf(this, ConcurrentActionError.prototype);
  }
}

/**
 * 萬能非同步生命週期、並發防護、錯誤追蹤與 Toast 核心 Hook
 *
 * 統一處理 loading 狀態、並發防護、Sentry 紀錄 (captureFlowFailure) 與 Toast 顯示。
 */
export default function useAsyncAction<TDefaultThrow extends boolean = true>(
  defaultConfig: AsyncActionConfig<TDefaultThrow> = EMPTY_CONFIG as AsyncActionConfig<TDefaultThrow>
) {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const pendingCountRef = useRef(0);
  const defaultConfigRef = useRef<AsyncActionConfig<boolean>>(defaultConfig);

  // 遵守 React 規範：同步更新 defaultConfigRef，避免在 render 階段直接寫入
  useEffect(() => {
    defaultConfigRef.current = defaultConfig;
  });

  const run = useCallback(
    async <T, TRunThrow extends boolean = TDefaultThrow>(
      fn: () => Promise<T>,
      runConfig?: AsyncActionConfig<TRunThrow>
    ): Promise<RunReturnType<TRunThrow, T>> => {
      const mergedCaptureFailure =
        defaultConfigRef.current?.captureFailure || runConfig?.captureFailure
          ? {
              ...defaultConfigRef.current?.captureFailure,
              ...runConfig?.captureFailure,
            }
          : undefined;

      const mergedToastOnError =
        defaultConfigRef.current?.toastOnError || runConfig?.toastOnError
          ? {
              ...defaultConfigRef.current?.toastOnError,
              ...runConfig?.toastOnError,
            }
          : undefined;

      const config = {
        throwError: true as unknown as TRunThrow,
        preventConcurrent: true,
        resetPendingOnSuccess: true,
        ...defaultConfigRef.current,
        ...runConfig,
        captureFailure: mergedCaptureFailure,
        toastOnError: mergedToastOnError,
      };

      const returnUndefined = () =>
        undefined as unknown as RunReturnType<TRunThrow, T>;

      const isThrowError = config.throwError ?? true;
      const isPreventConcurrent = config.preventConcurrent ?? true;

      // 並發防護：若當前正在執行中且開啟了 concurrency 限制
      if (isPreventConcurrent && pendingCountRef.current > 0) {
        if (isThrowError) {
          // 預設為 true 時，拋出專用自訂 Error 以防止呼叫端因收到 undefined 導致解構/存取崩潰，兼顧型別安全與執行期防禦
          // 自訂 Error 能讓全域錯誤監聽器（如 Sentry）或呼叫端輕易識別並過濾該型別，避免垃圾日誌，同時確保 await 能釋放且 finally 可正常執行
          throw new ConcurrentActionError();
        }
        return returnUndefined();
      }

      // 同步累加執行計數，支援完美的併發狀態管理與極短時間連按防護
      pendingCountRef.current++;

      setIsPending(true);

      let success = false;
      try {
        const result = await fn();
        success = true;
        config.onSuccess?.(result);
        return result as unknown as RunReturnType<TRunThrow, T>;
      } catch (err) {
        const shouldRethrow = isThrowError;

        // 執行外部傳入的錯誤 callback
        if (config.onError) {
          try {
            config.onError(err);
          } catch (callbackErr) {
            const rawMsg =
              callbackErr instanceof Error
                ? callbackErr.message
                : String(callbackErr);
            console.error(
              'Error in useAsyncAction onError callback:',
              safeSanitize(rawMsg)
            );
          }
        }

        // Sentry 錯誤記錄去重：由外部傳遞的 shouldSkipLogging 回撥決定
        const isAlreadyLogged = config.shouldSkipLogging?.(err) ?? false;

        const flow = config.captureFailure?.flow ?? config.flow;
        const step = resolveValue<string | undefined>(
          config.captureFailure?.step,
          config.step,
          err
        );
        const level = resolveValue<'info' | 'warning' | 'error' | undefined>(
          config.captureFailure?.level,
          config.level,
          err
        );
        const rawMsg = resolveValue<string | undefined>(
          config.captureFailure?.message,
          config.message,
          err
        );
        const errorCode = resolveValue<string | undefined>(
          config.captureFailure?.errorCode,
          config.errorCode,
          err
        );

        // 統一套用脫敏 (safeSanitize) 處理以防止自訂錯誤訊息洩漏 PII 至 Sentry
        const msg =
          safeSanitize(
            rawMsg || (err instanceof Error ? err.message : String(err))
          ) || 'Unexpected error in async action';

        if (!isAlreadyLogged && flow && step) {
          const p = captureFlowFailure({
            flow,
            step,
            message: msg,
            level,
            errorCode,
          });
          const promiseObj = p as Promise<unknown> | undefined;
          if (promiseObj && typeof promiseObj.catch === 'function') {
            promiseObj.catch((captureErr: unknown) => {
              const rawCaptureMsg =
                captureErr instanceof Error
                  ? captureErr.message
                  : String(captureErr);
              console.error(
                '[useAsyncAction] Failed to capture flow failure:',
                safeSanitize(rawCaptureMsg)
              );
            });
          }
        }

        const rawErrLogMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[AsyncAction] Error in ${flow ?? 'unknown'}:${step ?? 'unknown'}:`,
          safeSanitize(rawErrLogMsg)
        );

        // 觸發 Toast
        const errorMessage = resolveValue<string | undefined>(
          config.toastOnError?.description,
          config.errorMessage,
          err
        );
        const errorTitle = resolveValue<string | undefined>(
          config.toastOnError?.title,
          config.errorTitle,
          err
        );
        let duration = resolveValue<number | undefined>(
          config.toastOnError?.duration,
          config.duration,
          err
        );

        if (duration === undefined) {
          duration = 5000;
        }

        if (errorMessage) {
          toast({
            variant:
              (config.toastOnError?.variant as 'default' | 'destructive') ||
              'destructive',
            title: errorTitle,
            description: errorMessage,
            duration,
          });
        }

        // 重新拋出錯誤（推薦）或吞沒錯誤
        if (shouldRethrow) {
          throw err;
        }

        return returnUndefined();
      } finally {
        // 同步扣減執行計數
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);

        // 僅在所有併發非同步操作皆結束時，才重設為非 Pending 狀態
        if (pendingCountRef.current === 0) {
          // 若不重置（模擬轉址期間防止按鈕再度點擊），則僅在失敗時將 isPending 設為 false
          if (!success || config.resetPendingOnSuccess) {
            setIsPending(false);
          }
        }
      }
    },
    [toast]
  );

  return { run, isPending };
}

// 支援具名與預設匯出
export { useAsyncAction };
