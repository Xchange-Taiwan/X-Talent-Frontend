import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card 卡片元件：提供一個帶有圓角、邊框與陰影的容器外框，常用於承載、區隔及展示具備獨立主題的區塊內容。
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-background-white text-text-primary rounded-lg border shadow-sm',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

/**
 * CardHeader 卡片頂部欄：用於容納卡片的標題（CardTitle）及描述（CardDescription），提供合適的垂直邊距與間距。
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

/**
 * CardTitle 卡片標題：顯示於卡片頂部的主要醒目標題，預設套用粗體與合適的字型大小（2xl）。
 */
const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-2xl leading-none font-semibold tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

/**
 * CardDescription 卡片描述：緊鄰於標題下方的副標題或說明性文字，字型顏色預設較淡。
 */
const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-text-tertiary text-sm', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/**
 * CardContent 卡片主體內容區：放置卡片核心資訊與互動元件的區塊，內建與外框對齊的內邊距（padding）。
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

/**
 * CardFooter 卡片底部欄：常用於放置按鈕、操作項、連結或狀態提示等，並與卡片內容維持一致的對齊與間距。
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
