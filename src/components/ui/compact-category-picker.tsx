'use client';

import { Plus, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  type Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface CompactCategoryPickerProps {
  categories: Category[];
  value: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  maxSelected?: number;
  singleSelect?: boolean;
  flat?: boolean;
  searchPlaceholder?: string;
  limitHelperText?: (selected: number, max: number) => string;
  countText?: string;
  disabled?: boolean;
  className?: string;
}

export function CompactCategoryPicker({
  categories,
  value,
  onChange,
  addLabel,
  maxSelected = 10,
  singleSelect = false,
  flat = false,
  searchPlaceholder = '搜尋',
  limitHelperText,
  countText,
  disabled = false,
  className,
}: CompactCategoryPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      for (const opt of cat.options) {
        map.set(opt.value, opt.label);
      }
    }
    return map;
  }, [categories]);

  const handleRemove = (target: string) => {
    if (disabled) return;
    onChange(value.filter((item) => item !== target));
  };

  const handleSelectChange = (next: string[]) => {
    const prevLen = value.length;
    onChange(next);
    if (singleSelect && next.length === 1 && prevLen <= 1) {
      setOpen(false);
    }
  };

  const resolvedCountText =
    countText !== undefined
      ? countText
      : `已選 ${value.length} / ${maxSelected}`;

  return (
    <div className={cn('space-y-2.5', className)}>
      {value.length > 0 && (
        <ul
          aria-label="已選項目"
          className="flex flex-wrap items-center gap-2 p-0.5"
        >
          {value.map((code) => {
            const label = labelByValue.get(code) ?? code;
            return (
              <li
                key={code}
                className="bg-brand-100 text-brand-700 inline-flex min-h-[38px] items-center gap-1 rounded-full py-1 pr-1.5 pl-4 text-sm font-medium"
              >
                <span>{label}</span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`刪除${label}`}
                  onClick={() => handleRemove(code)}
                  className={cn(
                    FOCUS_RING_NO_OFFSET_CLASSES,
                    'text-brand-700 hover:bg-brand-200/70 inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50'
                  )}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                FOCUS_RING_NO_OFFSET_CLASSES,
                'border-background-border bg-background-white text-text-primary hover:bg-background-bottom min-h-[42px] rounded-md px-3.5 text-sm font-medium'
              )}
            >
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {addLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[min(360px,calc(100vw-32px))] border-0 bg-transparent p-0 shadow-lg"
          >
            <CategoryMultiSelect
              categories={categories}
              flat={flat}
              value={value}
              onChange={handleSelectChange}
              maxSelected={maxSelected}
              singleSelect={singleSelect}
              searchPlaceholder={searchPlaceholder}
              limitHelperText={limitHelperText}
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>

        {resolvedCountText && (
          <p className="text-text-tertiary text-xs tabular-nums">
            {resolvedCountText}
          </p>
        )}
      </div>
    </div>
  );
}
