'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import * as monitoring from '@/lib/monitoring';

const safeSanitize = (val: string) => {
  try {
    const s = (monitoring as any).sanitize;
    if (typeof s === 'function') {
      return s(val);
    }
  } catch {
    // 吸收 Vitest 代理 Mock 存取錯誤
  }
  return val;
};

const safeCaptureFlowFailure = (args: any) => {
  try {
    const c = (monitoring as any).captureFlowFailure;
    if (typeof c === 'function') {
      return c(args);
    }
  } catch {
    // 吸收 Vitest 代理 Mock 存取錯誤
  }
  return undefined;
};

export interface AsyncActionConfig<TThrowError extends boolean = boolean> {
  /**
   * Sentry 錯誤記錄的 Flow 名稱 (例如 'profile_update', 'sign_in')
   */
  flow?: string;
  /**
   * Sentry 錯誤記錄的 Step 步驟 (例如 'unexpected', 'submit')
   */
  step?: string | ((error: unknown) => string);
  /**
   * Sentry 錯誤記錄的 Level 層級
   */
  level?:
    | 'info'
    | 'warning'
    | 'error'
    | ((error: unknown) => 'info' | 'warning' | 'error' | undefined);
  /**
   * Sentry 錯誤記錄的自訂 Message
   */
  message?: string | ((error: unknown) => string);
  /**
   * Sentry 錯誤記錄的 Error Code
   */
  errorCode?: string | ((error: unknown) => string | undefined);
  /**
   * 發生錯誤時顯示的 Toast 標題
   */
  errorTitle?: string | ((error: unknown) => string | undefined);
  /**
   * 發生錯誤時顯示的 Toast 文案。如不提供則不彈出 Toast
   */
  errorMessage?: string | ((error: unknown) => string | undefined);
  /**
   * Toast 顯示持續時間（微秒），預設 5000 毫秒
   */
  duration?: number | ((error: unknown) => number | undefined);
  /**
   * Pluggable 錯誤回撥，提供額外的自訂處理邏輯
   */
  onError?: (error: unknown) => void;
  /**
   * 成功執行後的回撥
   */
  onSuccess?: (data: any) => void;
  /**
   * 是否在非同步操作失敗時重新拋出錯誤，讓呼叫端做額外處理。預設為 true。
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
   * 判斷此錯誤是否已經在底層被 logging過，避免重複上報。
   */
  shouldSkipLogging?: (error: unknown) => boolean;

  // 相容於分支中的巢狀物件與舊命名
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
    title?: string;
    description: string | ((error: unknown) => string);
    variant?: 'default' | 'destructive';
    duration?: number | ((error: unknown) => number | undefined);
  };
  rethrow?: boolean;
}

/**
 * 萬能非同步生命週期、並發防護、錯誤追蹤與 Toast 核心 Hook
 *
 * 統一處理 loading 狀態、並發防護、Sentry 紀錄 (captureFlowFailure) 與 Toast 顯示。
 */
export default function useAsyncAction<TDefaultThrow extends boolean = true>(
  defaultConfig: AsyncActionConfig<TDefaultThrow> = {}
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
    ): Promise<T | undefined> => {
      const config = {
        throwError: true as unknown as TRunThrow,
        preventConcurrent: true,
        resetPendingOnSuccess: true,
        ...defaultConfigRef.current,
        ...runConfig,
      };

      // 並發防護：若當前正在執行中且開啟了 concurrency 限制，直接忽略此次操作
      if (config.preventConcurrent && pendingCountRef.current > 0) {
        return undefined;
      }

      // 同步累加執行計數，支援完美的併發狀態管理與極短時間連按防護
      pendingCountRef.current++;

      setIsPending(true);

      let success = false;
      try {
        const result = await fn();
        success = true;
        config.onSuccess?.(result);
        return result;
      } catch (err) {
        const shouldRethrow = config.rethrow ?? config.throwError;

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

        let step = config.captureFailure?.step ?? config.step;
        if (typeof step === 'function') {
          step = step(err);
        }

        let level = config.captureFailure?.level ?? config.level;
        if (typeof level === 'function') {
          level = level(err);
        }

        let msg = config.captureFailure?.message ?? config.message;
        if (typeof msg === 'function') {
          msg = msg(err);
        } else if (!msg) {
          msg =
            safeSanitize(err instanceof Error ? err.message : String(err)) ??
            'Unexpected error in async action';
        }

        let errorCode = config.captureFailure?.errorCode ?? config.errorCode;
        if (typeof errorCode === 'function') {
          errorCode = errorCode(err);
        }

        if (!isAlreadyLogged && flow && step) {
          const p = safeCaptureFlowFailure({
            flow,
            step,
            message: msg,
            level: level as 'info' | 'warning' | 'error' | undefined,
            errorCode,
          });
          if (p && typeof p.catch === 'function') {
            p.catch((captureErr: any) => {
              const rawMsg =
                captureErr instanceof Error
                  ? captureErr.message
                  : String(captureErr);
              console.error(
                '[useAsyncAction] Failed to capture flow failure:',
                safeSanitize(rawMsg)
              );
            });
          }
        }

        const rawMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[AsyncAction] Error in ${flow ?? 'unknown'}:${step ?? 'unknown'}:`,
          safeSanitize(rawMsg)
        );

        // 觸發 Toast
        let errorMessage =
          config.toastOnError?.description ?? config.errorMessage;
        if (typeof errorMessage === 'function') {
          errorMessage = errorMessage(err);
        }

        let errorTitle = config.toastOnError?.title ?? config.errorTitle;
        if (typeof errorTitle === 'function') {
          errorTitle = errorTitle(err);
        }

        let duration = config.toastOnError?.duration ?? config.duration;
        if (typeof duration === 'function') {
          duration = duration(err);
        } else if (duration === undefined) {
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

        return undefined;
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
