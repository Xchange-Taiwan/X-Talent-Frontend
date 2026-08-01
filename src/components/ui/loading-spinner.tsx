import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /**
   * 額外的自訂 CSS 樣式類名。
   */
  className?: string;
  /**
   * 旋轉載入圖示的尺寸大小。
   * - 'sm': 16px (h-4 w-4)
   * - 'md': 24px (h-6 w-6)
   * - 'lg': 32px (h-8 w-8)
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 用於螢幕閱讀器的輔助無障礙說明標籤。
   * @default '載入中'
   */
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

/**
 * LoadingSpinner 旋轉載入指示器。
 *
 * 用於展示非同步資料加載或背景處理狀態。內置 `Loader2` (Lucide React) 動畫及無障礙標籤。
 *
 * @example
 * <LoadingSpinner size="lg" label="檔案上傳中..." />
 */
export function LoadingSpinner({
  className,
  size = 'md',
  label = '載入中',
}: LoadingSpinnerProps) {
  return (
    <span role="status" className="inline-flex">
      <Loader2
        aria-hidden="true"
        className={cn(
          'animate-spin text-text-tertiary',
          sizeClasses[size],
          className
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * PageLoading 頁面層級的全螢幕載入狀態。
 *
 * 預設高度為 50vh，並使 LoadingSpinner (lg) 水平垂直置中，適用於整頁加載或大區塊骨架屏載入。
 */
export function PageLoading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
