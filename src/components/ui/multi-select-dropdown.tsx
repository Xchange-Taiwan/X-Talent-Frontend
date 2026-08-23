'use client';

/**
 * MultiSelectDropdown
 *
 * Extracted dropdown content for MultiSelect. Lives in a separate chunk so
 * that cmdk (Command) and its dependencies are not included in the initial
 * bundle. This file is lazy-loaded by multi-select.tsx and is only fetched
 * the first time a MultiSelect popover is opened.
 */

import { CheckIcon } from 'lucide-react';
import * as React from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * MultiSelectDropdown 元件屬性介面
 */
export interface MultiSelectDropdownProps {
  /**
   * 可供選擇的下拉選項清單。
   */
  options: Array<{
    /**
     * 選項顯示的標籤文字。
     */
    label: string;
    /**
     * 選項對應的實際數值。
     */
    value: string;
    /**
     * 選項前方可選的圖示元件。
     */
    icon?: React.ComponentType<{ className?: string }>;
  }>;

  /**
   * 當前已被選中的值陣列。
   */
  selectedValues: string[];

  /**
   * 搜尋框輸入時的鍵盤事件回呼函式（例如偵測 Enter 或 Backspace）。
   */
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * 切換特定選項選取狀態的回呼函式。
   */
  onToggleOption: (value: string) => void;

  /**
   * 全選或取消全選時觸發的回呼函式。
   */
  onToggleAll: () => void;

  /**
   * 清除所有選中項目的回呼函式。
   */
  onClear: () => void;

  /**
   * 關閉下拉彈出視窗的回呼函式。
   */
  onClose: () => void;
}

/**
 * MultiSelectDropdown 多選下拉選單內容元件：
 * 作為 MultiSelect 的彈出層內容，內含過濾搜尋框、選項清單（含全選選項）、清除與關閉按鈕。
 * 本元件採用延遲加載（Lazy-load），僅在選單展開時進行 chunk 的 fetch，以縮小 initial bundle size。
 */
export default function MultiSelectDropdown({
  options,
  selectedValues,
  onInputKeyDown,
  onToggleOption,
  onToggleAll,
  onClear,
  onClose,
}: MultiSelectDropdownProps) {
  return (
    <Command>
      <CommandInput placeholder="Search..." onKeyDown={onInputKeyDown} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem
            key="all"
            onSelect={onToggleAll}
            className="cursor-pointer"
          >
            <div
              className={cn(
                'border-brand-500 mr-2 flex size-4 items-center justify-center rounded-sm border',
                selectedValues.length === options.length
                  ? 'bg-brand-500 text-text-primary'
                  : 'opacity-50 [&_svg]:invisible'
              )}
            >
              <CheckIcon className="size-4" />
            </div>
            <span>(Select All)</span>
          </CommandItem>
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                onSelect={() => onToggleOption(option.value)}
                className="cursor-pointer"
              >
                <div
                  className={cn(
                    'border-brand-500 mr-2 flex size-4 items-center justify-center rounded-sm border',
                    isSelected
                      ? 'bg-brand-500 text-text-primary'
                      : 'opacity-50 [&_svg]:invisible'
                  )}
                >
                  <CheckIcon className="size-4" />
                </div>
                {option.icon && (
                  <option.icon className="text-text-tertiary mr-2 size-4" />
                )}
                <span>{option.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <div className="flex items-center justify-between">
            {selectedValues.length > 0 && (
              <>
                <CommandItem
                  onSelect={onClear}
                  className="flex-1 cursor-pointer justify-center"
                >
                  Clear
                </CommandItem>
                <Separator
                  orientation="vertical"
                  className="flex h-full min-h-6"
                />
              </>
            )}
            <CommandItem
              onSelect={onClose}
              className="max-w-full flex-1 cursor-pointer justify-center"
            >
              Close
            </CommandItem>
          </div>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
