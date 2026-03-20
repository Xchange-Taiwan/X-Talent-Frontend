import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import * as Popover from '@radix-ui/react-popover';
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

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#E6E8EA] px-4 py-1">
          <div className="flex items-center gap-1">
            <FilterListIcon className="h-5 w-5" />
            <span>篩選</span>
          </div>
          {open ? (
            <ArrowDropUpIcon className="h-5 w-5" />
          ) : (
            <ArrowDropDownIcon className="h-5 w-5" />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="dark:bg-white z-[55] flex max-h-[calc(var(--radix-popover-content-available-height)-8px)] w-[320px] flex-col rounded-md border border-gray-200 bg-background-white shadow-xl"
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
          <div className="flex gap-2 border-t border-gray-100 p-4 pt-3">
            <Button className="w-full" onClick={applyFilters}>
              套用
            </Button>
            <Button className="w-full" variant="outline" onClick={clearFilters}>
              清除全部
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default MentorFilterDropdown;
