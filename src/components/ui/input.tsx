import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Properties for the Input component. Inherits all standard HTML input element attributes.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * The type of input to render (e.g., 'text', 'email', 'password', 'number', 'file', etc.).
   * @default 'text'
   */
  type?: string;

  /**
   * Whether the input is disabled and cannot be interacted with.
   * @default false
   */
  disabled?: boolean;

  /**
   * Short hint that describes the expected value of the input field.
   */
  placeholder?: string;

  /**
   * The controlled value of the input field.
   */
  value?: string | number | readonly string[];

  /**
   * Event handler triggered when the input value changes.
   */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

/**
 * A standard, stylized Input component for user text, email, password, and file entries.
 * Seamlessly integrates with focus states, disabled states, and responsive styling.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-background-border bg-background-white px-3 py-2 text-base ring-offset-background-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-tertiary focus-visible:ring focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
