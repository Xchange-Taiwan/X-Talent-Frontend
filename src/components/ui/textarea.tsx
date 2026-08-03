import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Textarea 元件屬性介面：繼承所有原生 HTML textarea 的屬性。
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Textarea 多行輸入框元件：
 * 提供自適應寬度的多行文字輸入區域，內建流暢的 Focus 外框動畫、Disabled 禁用狀態樣式，並支援與 React Hook Form 雙向綁定。
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'block w-full rounded-md border border-background-border bg-transparent px-3 py-2 text-base ring-offset-background-white placeholder:text-text-tertiary focus-visible:ring focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
