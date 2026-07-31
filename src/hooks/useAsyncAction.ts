'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure, sanitize } from '@/lib/monitoring';

export interface AsyncActionConfig<TThrowError extends boolean = boolean> {
  /**
   * Sentry 錯誤記錄的 Flow 名稱 (例如 'profile_update', 'sign_in')
   */
  flow?: string;
  /**
   * Sentry 錯誤記錄的 Step 步驟 (例如 'unexpected', 'submit')
   */
  step?: string;
  /**
   * 發生錯誤時顯示的 Toast 標題
   */
  errorTitle?: string;
  /**
   * 發生錯誤時顯示的 Toast 文案。如不提供則不彈出 Toast
   */
  errorMessage?: string;
  /**
   * Toast 顯示持續時間（微秒），預設 5000 毫秒
   */
  duration?: number;
  /**
   * Pluggable 錯誤回撥，提供額外的自訂處理邏輯
   */
  onError?: (error: unknown) => void;
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
 * 集中管理非同步操作（如表單提交、API 突變）生命週期的 React Hook。
 * 統一處理 loading 狀態、並發防護、組件卸載安全、Sentry 紀錄 (captureFlowFailure) 與 Toast 顯示。
 */
export function useAsyncAction<TDefaultThrow extends boolean = true>(
  defaultConfig: AsyncActionConfig<TDefaultThrow> = {}
) {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const isMounted = useRef(true);
  const pendingCountRef = useRef(0);
  const defaultConfigRef = useRef<AsyncActionConfig<boolean>>(defaultConfig);

  // 追蹤組件掛載狀態，防止在已卸載的組件上執行 setState 導致記憶體洩漏與 React 警告
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // 遵守 React 規範與 Next.js SSR 慣例：使用 useEffect 同步更新 defaultConfigRef，避免 SSR 期間觸發 LayoutEffect 警示
  useEffect(() => {
    defaultConfigRef.current = defaultConfig;
  });

  const run = useCallback(
    async <T, TRunThrow extends boolean = TDefaultThrow>(
      fn: () => Promise<T>,
      runConfig?: AsyncActionConfig<TRunThrow>
    ): Promise<RunReturnType<TRunThrow, T>> => {
      const config = {
        throwError: true as unknown as TRunThrow,
        preventConcurrent: true,
        resetPendingOnSuccess: true,
        ...defaultConfigRef.current,
        ...runConfig,
      };

      const returnUndefined = () =>
        undefined as unknown as RunReturnType<TRunThrow, T>;

      // 並發防護：若當前正在執行中且開啟了 concurrency 限制
      if (config.preventConcurrent && pendingCountRef.current > 0) {
        if (config.throwError) {
          // 預設為 true 時，拋出專用自訂 Error 以防止呼叫端因收到 undefined 導致解構/存取崩潰，兼顧型別安全與執行期防禦
          // 自訂 Error 能讓全域錯誤監聽器（如 Sentry）或呼叫端輕易識別並過濾該型別，避免垃圾日誌，同時確保 await 能釋放且 finally 可正常執行
          throw new ConcurrentActionError();
        }
        return returnUndefined();
      }

      // 同步累加執行計數，支援完美的併發狀態管理與極短時間連按防護
      pendingCountRef.current++;

      if (isMounted.current) {
        setIsPending(true);
      }

      let success = false;
      try {
        const result = await fn();
        success = true;
        return result as unknown as RunReturnType<TRunThrow, T>;
      } catch (err) {
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
              sanitize(rawMsg)
            );
          }
        }

        // Sentry 錯誤記錄去重：由外部傳遞的 shouldSkipLogging 回撥決定
        const isAlreadyLogged = config.shouldSkipLogging?.(err) ?? false;
        if (!isAlreadyLogged && config.flow && config.step) {
          const rawMessage =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'Unexpected error in async action';

          const p = captureFlowFailure({
            flow: config.flow,
            step: config.step,
            message: sanitize(rawMessage) ?? 'Unexpected error in async action',
          });

          if (p && typeof p.catch === 'function') {
            p.catch((captureErr) => {
              const rawCaptureMsg =
                captureErr instanceof Error
                  ? captureErr.message
                  : String(captureErr);
              console.error(
                '[useAsyncAction] Failed to capture flow failure:',
                sanitize(rawCaptureMsg)
              );
            });
          }
        }

        const rawMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[AsyncAction] Error in ${config.flow ?? 'unknown'}:${config.step ?? 'unknown'}:`,
          sanitize(rawMsg)
        );

        // 觸發 Toast
        if (config.errorMessage) {
          toast({
            variant: 'destructive',
            title: config.errorTitle,
            description: config.errorMessage,
            duration: config.duration ?? 5000,
          });
        }

        // 重新拋出錯誤（推薦）或吞沒錯誤
        if (config.throwError) {
          throw err;
        }

        return returnUndefined();
      } finally {
        // 同步扣減執行計數
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);

        // 僅在所有併發非同步操作皆結束時，才重設為非 Pending 狀態
        if (pendingCountRef.current === 0) {
          if (isMounted.current) {
            // 若不重置（模擬轉址期間防止按鈕再度點擊），則僅在失敗時將 isPending 設為 false
            if (!success || config.resetPendingOnSuccess) {
              setIsPending(false);
            }
          }
        }
      }
    },
    [toast]
  );

  return { run, isPending };
}
