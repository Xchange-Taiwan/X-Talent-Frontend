import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface AuthCardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  showBanner?: boolean;
  bannerContent?: ReactNode;
}

export default function AuthCard({
  children,
  className,
  contentClassName,
  showBanner = false,
  bannerContent,
}: AuthCardProps) {
  return (
    <div className="bg-background-white flex w-full flex-col items-center justify-center px-6 py-16 md:py-24">
      <div
        className={cn(
          'border-background-border bg-background-white shadow-card mx-auto w-full max-w-[630px] overflow-hidden rounded-2xl border',
          className
        )}
      >
        {showBanner && (
          <div className="bg-auth-card relative h-[108px]">{bannerContent}</div>
        )}
        <div
          className={cn(
            'flex flex-col items-center gap-6 px-6 py-10 md:px-14 md:py-16',
            showBanner && 'pt-16 md:pt-20',
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
