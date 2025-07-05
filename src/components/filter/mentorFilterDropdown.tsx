import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import * as Popover from '@radix-ui/react-popover';
import React, { useCallback, useState } from 'react';

import FilterSelect from '@/components/filter/filterSelect';
import { Button } from '@/components/ui/button';

export type FilterOptions = {
  [key: string]: {
    name: string;
    options: { label: string; value: string }[];
  };
};

interface SelectOptions {
  [key: string]: string;
}

interface MentorFilterDropdownProps {
  onChange: (filters: SelectOptions) => void;
  filterOptions: FilterOptions;
}

const MentorFilterDropdown = ({
  onChange,
  filterOptions,
}: MentorFilterDropdownProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<SelectOptions>({});

  const handleChange = (field: string, value: string) => {
    setSelectedFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = useCallback(() => {
    onChange(selectedFilters || {});
    setOpen(false);
  }, [selectedFilters, onChange]);

  const clearFilters = () => {
    setSelectedFilters({});
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#E6E8EA] px-4 py-1">
          <div className="flex items-center gap-1">
            <FilterListIcon className="h-5 w-5" />
            <span>Filters</span>
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
          className="dark:bg-white z-20 w-[320px] space-y-4 rounded-md border border-gray-200 bg-background-white p-4 shadow-xl"
          sideOffset={8}
        >
          {Object.entries(filterOptions).map(([key, { name, options }]) => (
            <FilterSelect
              key={key}
              name={name}
              value={selectedFilters[key] || ''}
              options={options}
              onChange={(val) => handleChange(key, val)}
            />
          ))}
          <div className="flex gap-2 pt-2">
            <Button className="w-full" onClick={applyFilters}>
              Apply
            </Button>
            <Button className="w-full" variant="outline" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default MentorFilterDropdown;
