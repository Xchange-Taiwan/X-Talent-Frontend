'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Dialog 對話框元件的根容器，用於控制對話框的開啟狀態與整體行為。
 *
 * 經由 Radix UI 的 Dialog.Root 封裝，支援受控 (controlled) 與非受控 (uncontrolled) 模式。
 *
 * @example
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogTrigger>開啟對話框</DialogTrigger>
 *   <DialogContent>對話框內容</DialogContent>
 * </Dialog>
 */
const Dialog = DialogPrimitive.Root;

/**
 * DialogTrigger 用於觸發對話框開啟的按鈕/元件。
 *
 * 預設會渲染為一個 button，通常會搭配 `asChild` 屬性將觸發行為套用至子元件（例如 Button）。
 *
 * @example
 * <DialogTrigger asChild>
 *   <Button>編輯檔案</Button>
 * </DialogTrigger>
 */
const DialogTrigger = DialogPrimitive.Trigger;

/**
 * DialogPortal 將對話框內容渲染至 React Portal 中，使其脫離常規 DOM 流，通常渲染於 body 底部以避免層級 (z-index) 衝突。
 */
const DialogPortal = DialogPrimitive.Portal;

/**
 * DialogClose 用於關閉對話框的觸發元件。
 *
 * 通常置於對話框內容之內，點擊時會將對話框的 open 狀態設為 false。
 */
const DialogClose = DialogPrimitive.Close;

/**
 * DialogOverlay 對話框的背景遮罩。
 *
 * 鋪滿整個螢幕，點擊遮罩預設會關閉對話框。支援動畫與透明度設定。
 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-dark/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * DialogContent 對話框的主體內容容器。
 *
 * 包含對話框的實際內容（如標題、描述、表單、按鈕等），內置預設的置中樣式、響應式設計與關閉按鈕。
 *
 * @param className - 額外的自訂樣式類名
 * @param children - 對話框內部的子元件
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background-white p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=open]:zoom-in-95 sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background-white transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none data-[state=open]:bg-background-bottom data-[state=open]:text-text-tertiary">
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">關閉</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * DialogHeader 對話框的頭部區域。
 *
 * 用於放置 DialogTitle (標題) 與 DialogDescription (描述文字)，提供標準的垂直間距。
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

/**
 * DialogFooter 對話框的底部區域。
 *
 * 用於放置操作按鈕（例如確認、取消、儲存等），在桌機版預設靠右對齊，手機版垂直排列。
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/**
 * DialogTitle 對話框的標題元件。
 *
 * 為螢幕閱讀器與無障礙功能 (accessibility) 提供明確的標題定義。
 */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg leading-none font-semibold tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * DialogDescription 對話框的描述文字元件。
 *
 * 用於提供標題之外的詳細輔助說明資訊。
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-text-tertiary', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
