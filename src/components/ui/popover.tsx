'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Popover 氣泡彈窗元件的根容器，用於控制氣泡彈窗的開啟狀態與整體行為。
 *
 * 基於 Radix UI 的 Popover.Root 封裝，適合用於展示選單、過濾器、微型表單等。
 */
const Popover = PopoverPrimitive.Root;

/**
 * PopoverTrigger 用於觸發氣泡彈窗開啟的按鈕/元件。
 *
 * 通常搭配 `asChild` 屬性將觸發行為套用至子元件（例如 Button）。
 */
const PopoverTrigger = PopoverPrimitive.Trigger;

/**
 * PopoverContent 氣泡彈窗的主體內容容器。
 *
 * 會自動渲染在 React Portal 中。具有預設的定位、陰影與開啟/關閉動畫。
 *
 * @param align - 對齊方式：'start' | 'center' | 'end'。預設為 'center'。
 * @param sideOffset - 氣泡與觸發按鈕之間的間距（像素數）。預設為 4。
 * @param className - 額外的自訂樣式類名
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-background-white p-4 text-text-primary shadow-md outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverContent, PopoverTrigger };
