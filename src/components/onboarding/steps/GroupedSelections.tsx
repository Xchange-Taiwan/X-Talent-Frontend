'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import * as React from 'react';

import type {
  Category,
  CategoryOption,
} from '@/components/ui/category-multi-select';
import { cn } from '@/lib/utils';

interface RenderItemArgs {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export interface GroupedSelectionsProps {
  categories: Category[];
  value: string[];
  onChange: (next: string[]) => void;
  maxSelected?: number;
  layoutClass: string;
  renderItem: (opt: CategoryOption, args: RenderItemArgs) => React.ReactNode;
}

export const GroupedSelections: React.FC<GroupedSelectionsProps> = ({
  categories,
  value,
  onChange,
  maxSelected = 10,
  layoutClass,
  renderItem,
}) => {
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.key, true]))
  );

  React.useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      categories.forEach((c) => {
        if (next[c.key] === undefined) next[c.key] = true;
      });
      return next;
    });
  }, [categories]);

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const limitReached = value.length >= maxSelected;

  const toggleOption = (optionValue: string): void => {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
      return;
    }
    if (limitReached) return;
    onChange([...value, optionValue]);
  };

  const toggleSection = (key: string): void => {
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <p
        className={cn(
          'text-sm tabular-nums',
          limitReached ? 'text-status-200' : 'text-text-tertiary'
        )}
        aria-live="polite"
      >
        已選 {value.length} / {maxSelected}
        {limitReached ? ' — 取消其他項目以繼續選擇' : ''}
      </p>

      {categories.map((cat) => {
        const open = Boolean(openMap[cat.key]);
        const selectedInCat = cat.options.reduce(
          (acc, o) => acc + (selectedSet.has(o.value) ? 1 : 0),
          0
        );

        return (
          <section key={cat.key} className="space-y-3">
            <button
              type="button"
              onClick={() => toggleSection(cat.key)}
              className="flex w-full items-center justify-between"
              aria-expanded={open}
            >
              <span className="flex items-center gap-2">
                {open ? (
                  <ChevronDown className="h-5 w-5 text-text-secondary" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-text-secondary" />
                )}
                <h3 className="text-base font-semibold text-text-primary">
                  {cat.label}
                </h3>
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-sm tabular-nums',
                  selectedInCat > 0
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-text-tertiary'
                )}
              >
                {selectedInCat} / {cat.options.length}
              </span>
            </button>

            {open && (
              <div className={layoutClass}>
                {cat.options.map((opt) => {
                  const checked = selectedSet.has(opt.value);
                  const disabled = !checked && limitReached;
                  return (
                    <React.Fragment key={opt.value}>
                      {renderItem(opt, {
                        checked,
                        disabled,
                        onToggle: () => toggleOption(opt.value),
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
