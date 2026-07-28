import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-brand-500 text-text-primary hover:bg-brand-500/80',
        secondary:
          'border-transparent bg-background-bottom text-text-primary hover:bg-background-bottom/80',
        destructive:
          'border-transparent bg-status-200 text-text-white hover:bg-status-200/80',
        outline: 'text-text-primary',
        filter:
          'py-1.5 pr-2 pl-3 h-8 border border-background-border rounded-lg gap-2 hover:bg-background-bottom-secondary transition-colors',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
