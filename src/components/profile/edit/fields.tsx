'use client';

import { FieldPath,FieldValues, UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { ProfileFormValues } from './profileSchema';

//--------------------------------------------------
// 📦 Reusable Field Components
//--------------------------------------------------

export interface TextFieldProps {
  form: UseFormReturn<ProfileFormValues>;
  /** Only string fields are supported; use `as const` for other types to avoid errors */
  name: keyof ProfileFormValues;
  /** Placeholder text (you can pass Traditional Chinese here) */
  placeholder?: string;
  /** HTML input type (e.g. "text", "email") */
  type?: React.HTMLInputTypeAttribute;
}

/**
 * A generic text input field that guards against non-string values.
 */
export const TextField = ({
  form,
  name,
  placeholder,
  type = 'text',
}: TextFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          {/* Render empty string for non-string values to satisfy InputProps */}
          <Input
            {...field}
            value={typeof field.value === 'string' ? field.value : ''}
            placeholder={placeholder}
            type={type}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

export interface TextareaFieldProps extends Omit<TextFieldProps, 'type'> {
  /** Number of rows (height) for the textarea */
  rows?: number;
}

/**
 * A generic textarea field with configurable row height.
 */
export const TextareaField = ({
  form,
  name,
  rows = 6,
  placeholder,
}: TextareaFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          {/* Render empty string for non-string values to satisfy TextareaProps */}
          <Textarea
            {...field}
            value={typeof field.value === 'string' ? field.value : ''}
            placeholder={placeholder}
            className={`h-${rows * 8}`}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

export interface SelectFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  placeholder?: string;
  options: Array<{ label: string; value: string }>;
}

/**
 * A generic select dropdown field.
 */
export const SelectField = <T extends FieldValues>({
  form,
  name,
  placeholder,
  options,
}: SelectFieldProps<T>) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <Select
          onValueChange={field.onChange}
          value={typeof field.value === 'string' ? field.value : ''}
          defaultValue={typeof field.value === 'string' ? field.value : ''}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);
