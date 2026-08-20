'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
  Control,
  FieldPath,
  FieldValues,
  UseFormReturn,
} from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

//--------------------------------------------------
// 📦 Reusable Field Components
//--------------------------------------------------

export interface TextFieldProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  control: Control<TFieldValues>;
  /** Only string fields are supported; use `as const` for other types to avoid errors */
  name: FieldPath<TFieldValues>;
  /** Placeholder text (you can pass Traditional Chinese here) */
  placeholder?: string;
  /** HTML input type (e.g. "text", "email") */
  type?: React.HTMLInputTypeAttribute;
}

/**
 * A generic text input field that guards against non-string values.
 */
export const TextField = <TFieldValues extends FieldValues>({
  control,
  name,
  placeholder,
  type = 'text',
}: TextFieldProps<TFieldValues>) => (
  <FormField
    control={control}
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

export interface TextareaFieldProps<
  TFieldValues extends FieldValues = FieldValues,
> extends Omit<TextFieldProps<TFieldValues>, 'type'> {
  /** Number of rows (height) for the textarea */
  rows?: number;
}

/**
 * A generic textarea field with configurable row height.
 */
export const TextareaField = <TFieldValues extends FieldValues>({
  control,
  name,
  rows = 6,
  placeholder,
}: TextareaFieldProps<TFieldValues>) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          {/* Render empty string for non-string values to satisfy TextareaProps */}
          <Textarea
            {...field}
            value={typeof field.value === 'string' ? field.value : ''}
            placeholder={placeholder}
            rows={rows}
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

export interface ComboboxFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  options: Array<{ label: string; value: string }>;
}

/**
 * A searchable single-select combobox, for fields whose option list is too
 * large for Select: Radix Select always mounts a hidden native <select>
 * mirroring every SelectItem (even while closed, for native form/typeahead
 * support), so a several-hundred-option Select forces that many DOM nodes on
 * mount regardless of open state. Popover+Command has no such mirror — its
 * option list only mounts once opened.
 */
export const ComboboxField = <T extends FieldValues>({
  form,
  name,
  placeholder = '請選擇',
  searchPlaceholder = '搜尋...',
  emptyText = '沒有符合的選項',
  options,
}: ComboboxFieldProps<T>) => {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const selected = options.find((opt) => opt.value === field.value);
        return (
          <FormItem>
            <Popover
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) field.onBlur();
              }}
            >
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    ref={field.ref}
                    disabled={field.disabled}
                    onBlur={field.onBlur}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between px-3 py-2 text-base font-normal hover:bg-background-white hover:text-text-primary disabled:cursor-not-allowed md:text-sm"
                  >
                    <span className={cn(!selected && 'text-text-tertiary')}>
                      {selected ? selected.label : placeholder}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder={searchPlaceholder} />
                  <CommandList>
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup>
                      {options.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.label}
                          onSelect={() => {
                            field.onChange(opt.value);
                            field.onBlur();
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 size-4',
                              opt.value === field.value
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {opt.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
