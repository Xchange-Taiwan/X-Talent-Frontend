'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';

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
   * 是否在處理完錯誤後重新拋出（reject）。預設為 true（推薦，防止下游邏輯誤判成功）。
   * 設定為 false 時將吞沒錯誤並 resolve 成 undefined。
   */
  throwError?: TThrowError;
  /**
   * 是否啟用並發防護（防連點）。預設為 true，當正在執行時直接拒絕後續呼叫。
   */
  preventConcurrent?: boolean;
  /**
   * 成功執行後是否重置 isPending 為 false。預設為 true。
   * 如果設定為 false，成功後 isPending 將保持為 true（例如用於模擬並在跳轉/導航期間防止按鈕被再次點擊）。
   */
  resetPendingOnSuccess?: boolean;
  /**
   * 決定是否跳過 Sentry 紀錄。例如呼叫端可判斷該錯誤是否已被下層 LoggedError 記錄過，如果是則返回 true 去重。
   */
  shouldSkipLogging?: (error: unknown) => boolean;
}

type RunReturnType<TRunThrow extends boolean, T> = TRunThrow extends false
  ? T | undefined
  : T;

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
          // 預設為 true 時，拋出明確錯誤以防止呼叫端因收到 undefined 導致解構/存取崩潰，兼顧型別安全與執行期防禦
          throw new Error('Action is already pending');
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
            console.error(
              'Error in useAsyncAction onError callback:',
              callbackErr
            );
          }
        }

        // Sentry 錯誤記錄去重：由外部傳遞的 shouldSkipLogging 回撥決定
        const isAlreadyLogged = config.shouldSkipLogging?.(err) ?? false;
        if (!isAlreadyLogged && config.flow && config.step) {
          captureFlowFailure({
            flow: config.flow,
            step: config.step,
            message:
              err instanceof Error
                ? err.message
                : typeof err === 'string'
                  ? err
                  : 'Unexpected error in async action',
          });
        }

        console.error(
          `[AsyncAction] Error in ${config.flow ?? 'unknown'}:${config.step ?? 'unknown'}:`,
          err
        );

        // 觸發 Toast
        if (config.errorMessage) {
          toast({
            variant: 'destructive',
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
