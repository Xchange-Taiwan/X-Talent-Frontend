'use client';

import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CategoryOption {
  value: string;
  label: string;
}

export interface Category {
  key: string;
  label: string;
  options: CategoryOption[];
}

export interface CategoryMultiSelectProps {
  categories: Category[];
  /**
   * When true, render all options as a single flat list without category
   * headers / collapse. Use for menus that don't have a parent grouping
   * (e.g. industry).
   */
  flat?: boolean;
  value: string[];
  onChange: (next: string[]) => void;
  maxSelected?: number;
  searchPlaceholder?: string;
  emptyText?: string;
  limitHelperText?: (selected: number, max: number) => string;
  className?: string;
}

const defaultLimitHelper = (selected: number, max: number): string =>
  selected >= max
    ? `已選 ${selected} / ${max} — 取消其他項目以繼續選擇`
    : `已選 ${selected} / ${max}`;

function FlatList({
  options,
  selectedSet,
  limitReached,
  onToggle,
  emptyText,
}: {
  options: CategoryOption[];
  selectedSet: Set<string>;
  limitReached: boolean;
  onToggle: (value: string) => void;
  emptyText: string;
}): React.ReactElement {
  if (options.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-text-tertiary">
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="py-2">
      {options.map((opt) => {
        const checked = selectedSet.has(opt.value);
        const disabled = !checked && limitReached;
        return (
          <li key={opt.value}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 px-4 py-2',
                disabled && 'cursor-not-allowed opacity-50',
                !disabled && 'hover:bg-background-top'
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggle(opt.value)}
              />
              <span className="text-base text-text-primary">{opt.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryMultiSelect({
  categories,
  flat = false,
  value,
  onChange,
  maxSelected = 10,
  searchPlaceholder = 'Search...',
  emptyText = '沒有符合的選項',
  limitHelperText = defaultLimitHelper,
  className,
}: CategoryMultiSelectProps): React.ReactElement {
  const [query, setQuery] = React.useState('');
  const [manualOpen, setManualOpen] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(categories.map((c) => [c.key, false]))
  );

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const filteredCategories = React.useMemo(() => {
    if (!isSearching) return categories;
    return categories
      .map((c) => ({
        ...c,
        options: c.options.filter(
          (o) =>
            o.label.toLowerCase().includes(trimmedQuery) ||
            c.label.toLowerCase().includes(trimmedQuery)
        ),
      }))
      .filter((c) => c.options.length > 0);
  }, [categories, trimmedQuery, isSearching]);

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const limitReached = value.length >= maxSelected;

  const toggle = (optionValue: string): void => {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
      return;
    }
    if (limitReached) return;
    onChange([...value, optionValue]);
  };

  const isOpen = (key: string): boolean =>
    isSearching ? true : Boolean(manualOpen[key]);

  const toggleCategory = (key: string): void => {
    setManualOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const countSelectedIn = (cat: Category): number =>
    cat.options.reduce((acc, o) => acc + (selectedSet.has(o.value) ? 1 : 0), 0);

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-background-border bg-background-white',
        className
      )}
    >
      <div className="border-b border-background-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {flat && (
          <FlatList
            options={filteredCategories.flatMap((c) => c.options)}
            selectedSet={selectedSet}
            limitReached={limitReached}
            onToggle={toggle}
            emptyText={emptyText}
          />
        )}

        {!flat && filteredCategories.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-text-tertiary">
            {emptyText}
          </div>
        )}

        {!flat &&
          filteredCategories.map((cat, idx) => {
            const open = isOpen(cat.key);
            const selectedCount = countSelectedIn(cat);
            const total = cat.options.length;
            const hasSelection = selectedCount > 0;

            return (
              <div
                key={cat.key}
                className={cn(idx !== 0 && 'border-t border-background-border')}
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  disabled={isSearching}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-3 text-left',
                    !isSearching && 'hover:bg-background-top'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-text-secondary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-text-secondary" />
                    )}
                    <span className="text-base font-semibold text-text-primary">
                      {cat.label}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-sm tabular-nums',
                      hasSelection
                        ? 'bg-brand-100 text-brand-700'
                        : 'text-text-tertiary'
                    )}
                  >
                    {selectedCount} / {total}
                  </span>
                </button>

                {open && (
                  <ul className="pb-2">
                    {cat.options.map((opt) => {
                      const checked = selectedSet.has(opt.value);
                      const disabled = !checked && limitReached;
                      return (
                        <li key={opt.value}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-3 px-4 py-2 pl-11',
                              disabled && 'cursor-not-allowed opacity-50',
                              !disabled && 'hover:bg-background-top'
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() => toggle(opt.value)}
                            />
                            <span className="text-base text-text-primary">
                              {opt.label}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
      </div>

      <div
        className={cn(
          'border-t border-background-border px-4 py-2 text-sm tabular-nums',
          limitReached ? 'text-status-200' : 'text-text-tertiary'
        )}
        aria-live="polite"
      >
        {limitHelperText(value.length, maxSelected)}
      </div>
    </div>
  );
}
