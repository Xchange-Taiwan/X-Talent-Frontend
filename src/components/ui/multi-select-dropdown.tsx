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

export interface MultiSelectDropdownProps {
  options: Array<{
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  selectedValues: string[];
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onToggleOption: (value: string) => void;
  onToggleAll: () => void;
  onClear: () => void;
  onClose: () => void;
}

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
                'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                selectedValues.length === options.length
                  ? 'bg-primary text-primary-foreground'
                  : 'opacity-50 [&_svg]:invisible'
              )}
            >
              <CheckIcon className="h-4 w-4" />
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
                    'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible'
                  )}
                >
                  <CheckIcon className="h-4 w-4" />
                </div>
                {option.icon && (
                  <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
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
