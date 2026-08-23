'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * DropdownMenu 下拉選單元件的根容器，用於協調選單的開啟與關閉狀態。
 *
 * 經由 Radix UI 的 DropdownMenu.Root 封裝，支援鍵盤導覽、無障礙存取 (a11y) 等完整功能。
 */
const DropdownMenu = DropdownMenuPrimitive.Root;

/**
 * DropdownMenuTrigger 用於觸發下拉選單開啟的按鈕/元件。
 *
 * 預設渲染為 button，建議搭配 `asChild` 屬性套用至自訂元件。
 */
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/**
 * DropdownMenuGroup 用於將下拉選單中的項目 (Items) 進行邏輯分組。
 *
 * 對於螢幕閱讀器非常有用，用來提升無障礙體驗。
 */
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/**
 * DropdownMenuPortal 將下拉選單內容渲染至 React Portal 中，以避免層級 (z-index) 遮擋問題。
 */
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

/**
 * DropdownMenuSub 子下拉選單容器。
 *
 * 用於在現有的下拉選單中嵌套另一層選單。
 */
const DropdownMenuSub = DropdownMenuPrimitive.Sub;

/**
 * DropdownMenuRadioGroup 下拉選單單選組容器。
 *
 * 可與 DropdownMenuRadioItem 配合使用，提供在一組選單項目中進行單選的功能。
 */
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/**
 * DropdownMenuSeparator 下拉選單分割線。
 *
 * 用於分隔選單項目之邏輯區塊。
 */
const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('bg-background-bottom -mx-1 my-1 h-px', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

/**
 * DropdownMenuSubTrigger 用於觸發子選單 (SubMenu) 開啟的選單項目。
 *
 * 渲染後右側會帶有箭頭圖示。
 *
 * @param inset - 是否向內縮排（留出圖示空間）
 */
const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'hover:bg-background-bottom hover:text-text-primary flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

/**
 * DropdownMenuSubContent 子選單的內容容器。
 *
 * 在滑鼠懸停或選中子選單觸發器時展開。
 */
const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'bg-background-white text-text-primary animate-in slide-in-from-left-1 z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md',
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

/**
 * DropdownMenuContent 下拉選單的主體內容容器。
 *
 * 會自動渲染在 React Portal 中。內置預設的彈出動畫與定位系統。
 *
 * @param sideOffset - 選單與觸發按鈕之間的間距（像素數）。預設為 4。
 * @param className - 額外的自訂樣式類名
 */
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'bg-background-white text-text-primary animate-in fade-in-0 zoom-in-95 z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

/**
 * DropdownMenuItem 下拉選單中的標準可點擊項目。
 *
 * 支援選中狀態樣式與鍵盤焦點移動。
 *
 * @param inset - 是否向內縮排（留出圖示空間）
 */
const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'focus:bg-background-bottom focus:text-text-primary relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
