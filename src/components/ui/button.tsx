import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center text-sm font-medium ring-offset-background-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-500 text-text-primary hover:bg-brand-500/90',
        destructive:
          'bg-status-error-default text-text-white hover:bg-status-error-default/90',
        outline:
          'border border-background-border bg-background-white hover:bg-background-bottom hover:text-text-primary',
        secondary:
          'bg-background-bottom text-text-primary hover:bg-background-bottom/80',
        ghost: 'hover:bg-background-bottom hover:text-text-primary',
        link: 'text-brand-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'size-10',
      },
      shape: {
        default: 'rounded-md',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default',
    },
  }
);

/**
 * Properties for the Button component. Inherits all standard HTML button attributes
 * and variant configuration properties from the CVA (class-variance-authority) configuration.
 */
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * The visual style variant of the button.
   * @default 'default'
   */
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | null;

  /**
   * The size of the button, controlling height and padding.
   * @default 'default'
   */
  size?: 'default' | 'sm' | 'lg' | 'icon' | null;

  /**
   * The shape / border-radius configuration of the button.
   * @default 'default'
   */
  shape?: 'default' | 'pill' | null;

  /**
   * If true, the button will render as its child component instead of a native button element.
   * This is useful when you want to use custom elements (like Next.js Link) but keep button styling.
   * @default false
   */
  asChild?: boolean;
}

/**
 * A highly customizable and reusable Button component that supports various visual styles,
 * sizes, and shapes based on the class-variance-authority (CVA) design token mappings.
 * It also supports custom elements via Radix UI's Slot wrapper using the `asChild` property.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
