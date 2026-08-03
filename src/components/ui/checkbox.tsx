'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Properties for the Checkbox component. Inherits standard Radix UI Checkbox Primitive Root properties.
 */
export interface CheckboxProps extends React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive.Root
> {
  /**
   * The controlled checked state of the checkbox.
   */
  checked?: boolean | 'indeterminate';

  /**
   * The default checked state when first rendered.
   */
  defaultChecked?: boolean;

  /**
   * Event handler called when the checked state changes.
   */
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;

  /**
   * Whether the checkbox is disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * Whether the checkbox is required for form submission.
   */
  required?: boolean;

  /**
   * The name of the checkbox (for form submission).
   */
  name?: string;

  /**
   * The value of the checkbox (for form submission).
   * @default "on"
   */
  value?: string;
}

/**
 * A custom checkbox component built on top of Radix UI's Checkbox primitive,
 * with customizable styling and accessibility features built-in.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer size-4 shrink-0 rounded-sm border border-brand-500 ring-offset-background-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand-500 data-[state=checked]:text-text-primary',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <Check className="size-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
