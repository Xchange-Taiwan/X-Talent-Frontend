import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * ToastProvider 吐司通知元件的全局提供者 (Provider)。
 *
 * 用於管理與調度多個 Toast 吐司通知的渲染。
 */
const ToastProvider = ToastPrimitives.Provider;

/**
 * ToastViewport 吐司通知元件的顯示區域（視窗）。
 *
 * 定位在畫面中特定的角落（預設為右下角/右上角），所有 Toast 都會被渲染在此 Viewport 之中。
 */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col md:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:animate-in data-[state=open]:slide-in-from-top-full data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background-white text-text-primary',
        // eslint-disable-next-line tailwindcss/no-custom-classname
        destructive:
          'destructive group border-status-error-default bg-status-error-default text-text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Toast 單個吐司通知元件的主體。
 *
 * 支援預設 (default) 與破壞性/錯誤 (destructive) 等多種視覺變體 (variant)。
 *
 * @param variant - 吐司通知樣式變體：'default' | 'destructive'。
 */
const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

/**
 * ToastAction 吐司通知內的自訂動作按鈕（例如：重試、撤銷等）。
 *
 * 會自動繼承 Toast 的變體風格。
 */
const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background-white transition-colors group-[.destructive]:border-background-bottom/40 hover:bg-background-bottom group-[.destructive]:hover:border-status-error-default/30 group-[.destructive]:hover:bg-status-error-default group-[.destructive]:hover:text-text-white focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none group-[.destructive]:focus:ring-status-error-default disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

/**
 * ToastClose 用於關閉個別吐司通知的按鈕（預設顯示為右上角 X 圖標）。
 */
const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute top-2 right-2 rounded-md p-1 text-text-primary/50 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-status-error-active hover:text-text-primary group-[.destructive]:hover:text-text-white focus:opacity-100 focus-visible:ring-2 focus-visible:outline-none group-[.destructive]:focus-visible:ring-status-error-active group-[.destructive]:focus-visible:ring-offset-status-error-default',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="size-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

/**
 * ToastTitle 吐司通知的標題。
 */
const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

/**
 * ToastDescription 吐司通知的詳細描述文字。
 */
const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  Toast,
  ToastAction,
  type ToastActionElement,
  ToastClose,
  ToastDescription,
  type ToastProps,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
