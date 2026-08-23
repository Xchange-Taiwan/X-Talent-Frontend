'use client';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Sheet 側邊抽屜 (Drawer) 元件的根容器，用於控制抽屜的開啟狀態與整體行為。
 *
 * 經由 Radix UI 的 Dialog.Root (重新導出為 Sheet) 封裝，支援自訂滑出方向 (top, bottom, left, right)。
 */
const Sheet = SheetPrimitive.Root;

/**
 * SheetTrigger 用於觸發側邊抽屜開啟的按鈕/元件。
 *
 * 通常搭配 `asChild` 屬性將觸發行為套用至子元件（例如 Button）。
 */
const SheetTrigger = SheetPrimitive.Trigger;

/**
 * SheetClose 用於關閉側邊抽屜的觸發元件。
 *
 * 通常置於側邊抽屜內容之內，點擊時會關閉抽屜。
 */
const SheetClose = SheetPrimitive.Close;

/**
 * SheetPortal 將側邊抽屜內容渲染至 React Portal 中，使其脫離常規 DOM 流，渲染於 body 底部。
 */
const SheetPortal = ({ ...props }: SheetPrimitive.DialogPortalProps) => (
  <SheetPrimitive.Portal {...props} />
);
SheetPortal.displayName = SheetPrimitive.Portal.displayName;

/**
 * SheetOverlay 側邊抽屜的背景遮罩。
 *
 * 鋪滿整個螢幕，預設具有半透明與模糊效果 (backdrop-blur-sm)。
 */
const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'bg-background-white/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 backdrop-blur-sm',
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background-white p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=closed]:animate-out data-[state=open]:duration-500 data-[state=open]:animate-in',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /**
   * 是否顯示預設的關閉按鈕（位於右上角）。
   * @default false
   */
  showPrimitiveClose?: boolean;
}

/**
 * SheetContent 側邊抽屜的主體內容容器。
 *
 * 控制抽屜的滑出方向、寬高、樣式，並決定是否渲染預設關閉按鈕。
 *
 * @param side - 抽屜滑出方向：'top' | 'bottom' | 'left' | 'right'。預設為 'right'。
 * @param showPrimitiveClose - 是否顯示右上角的預設關閉按鈕。預設為 false。
 */
const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = 'right',
      className,
      showPrimitiveClose = false,
      children,
      ...props
    },
    ref
  ) => (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showPrimitiveClose && (
          <SheetPrimitive.Close className="ring-offset-background-white focus-visible:ring-ring data-[state=open]:bg-background-bottom absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">關閉</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

/**
 * SheetHeader 側邊抽屜的頭部區域。
 *
 * 用於放置標題 (SheetTitle) 與描述文字 (SheetDescription)。
 */
const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

/**
 * SheetFooter 側邊抽屜的底部區域。
 *
 * 用於放置操作按鈕，預設支援響應式佈局。
 */
const SheetFooter = ({
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
SheetFooter.displayName = 'SheetFooter';

/**
 * SheetTitle 側邊抽屜的標題元件。
 *
 * 提供側邊抽屜明確的無障礙 (ARIA) 標題。
 */
const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-text-primary text-lg font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

/**
 * SheetDescription 側邊抽屜的描述文字元件。
 *
 * 用於提供標題之外的詳細輔助說明資訊。
 */
const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-text-tertiary text-sm', className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
