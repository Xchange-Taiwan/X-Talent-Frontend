import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, ChevronUp, ListFilter } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import FilterSelect from '@/components/filter/FilterSelect';
import { Button } from '@/components/ui/button';

export type FilterOptions = {
  [key: string]: {
    name: string;
    options: { label: string; value: string }[];
  };
};

export interface SelectFilters {
  [key: string]: {
    name: string;
    value: string;
  };
}

interface MentorFilterDropdownProps {
  onChange: (filters: SelectFilters) => void;
  filterOptions: FilterOptions;
  selectOptions: SelectFilters;
}

const MentorFilterDropdown = ({
  onChange,
  filterOptions,
  selectOptions,
}: MentorFilterDropdownProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [pendingFilters, setPendingFilters] =
    useState<SelectFilters>(selectOptions);

  const handleChange = (field: string, name: string, value: string) => {
    setPendingFilters((prev) => ({
      ...prev,
      [field]: { name, value },
    }));
  };

  const applyFilters = useCallback(() => {
    onChange(pendingFilters || {});
    setOpen(false);
  }, [pendingFilters, onChange]);

  const clearFilters = () => {
    setPendingFilters({});
  };

  useEffect(() => {
    setPendingFilters(selectOptions);
  }, [selectOptions]);

  const activeEntries = Object.entries(pendingFilters || {}).filter(
    ([, item]) => Boolean(item?.value)
  );
  const activeFilterTypes =
    activeEntries.length > 0
      ? activeEntries.map(([key]) => key).join(',')
      : 'none';
  const activeFilterValues =
    activeEntries.length > 0
      ? activeEntries.map(([, item]) => item.value).join(',')
      : 'cleared';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className="w-full gap-2 font-normal"
          data-analytics-click="mentor_pool_filter_dropdown_open"
          data-analytics-feature="mentor_pool"
          data-analytics-location="filter_bar"
        >
          <div className="flex items-center gap-1">
            <ListFilter className="size-5" />
            <span>篩選</span>
          </div>
          {open ? (
            <ChevronUp className="size-5" />
          ) : (
            <ChevronDown className="size-5" />
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="border-background-border bg-background-white z-[55] flex max-h-[calc(var(--radix-popover-content-available-height)-8px)] w-[320px] flex-col rounded-md border shadow-xl"
          sideOffset={8}
          collisionPadding={8}
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-2">
            {Object.entries(filterOptions).map(([key, { name, options }]) => (
              <FilterSelect
                key={key}
                name={name}
                value={pendingFilters[key]?.value || ''}
                options={options}
                onChange={(val) => handleChange(key, name, val)}
              />
            ))}
          </div>
          <div className="border-background-border flex gap-2 border-t p-4 pt-3">
            <Button
              className="w-full"
              onClick={applyFilters}
              data-analytics-click="mentor_pool_filter_apply"
              data-analytics-event="mentor_pool_filter_apply"
              data-analytics-feature="mentor_pool"
              data-analytics-location="filter_dropdown"
              data-analytics-param-filter-type={activeFilterTypes}
              data-analytics-param-filter-value={activeFilterValues}
            >
              套用
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={clearFilters}
              data-analytics-click="mentor_pool_dropdown_clear_all"
              data-analytics-feature="mentor_pool"
              data-analytics-location="filter_dropdown"
            >
              清除全部
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default MentorFilterDropdown;
