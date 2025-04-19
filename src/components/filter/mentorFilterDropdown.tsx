import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import * as Popover from '@radix-ui/react-popover';
import React, { useCallback, useState } from 'react';

import FilterSelect from '@/components/filter/filterSelect';
import { Button } from '@/components/ui/button';
import { UserType } from '@/services/user/user';

export type FilterOptions = {
  [key: string]: {
    name: string;
    options: { label: string; value: string }[];
  };
};

interface MentorFilterDropdownProps {
  users: UserType[];
  onChange: (filteredUsers: UserType[]) => void;
  filterOptions: FilterOptions;
}

const MentorFilterDropdown = ({
  users,
  onChange,
  filterOptions,
}: MentorFilterDropdownProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<{
    [key: string]: string;
  }>({});

  const handleChange = (field: string, value: string) => {
    setSelectedFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = useCallback(() => {
    const filtered = users.filter((user) =>
      Object.entries(selectedFilters).every(([key, value]) => {
        const typedKey = key as keyof UserType;
        const userValue = user[typedKey];
        if (typeof userValue === 'object' && userValue !== null) {
          return (userValue as { category?: string }).category === value;
        }
        return userValue === value;
      }),
    );
    onChange(filtered);
    setOpen(false);
  }, [users, selectedFilters, onChange]);

  const clearFilters = useCallback(() => {
    setSelectedFilters({});
    onChange(users);
    setOpen(false);
  }, [users, onChange]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className="flex w-[15%] items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <FilterListIcon className="h-4 w-4 text-gray-700" />
            <span>Filters</span>
          </div>
          {open ? (
            <ArrowDropUpIcon className="h-4 w-4 text-gray-700" />
          ) : (
            <ArrowDropDownIcon className="h-4 w-4 text-gray-700" />
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-white dark:bg-white z-[9999] w-[320px] space-y-4 rounded-md border border-gray-200 p-4 shadow-xl"
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
