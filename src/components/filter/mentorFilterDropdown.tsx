import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'; // Import the down arrow icon
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useState } from 'react';

import FilterSelect from '@/components/filter/filterSelect';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const MentorFilterDropdown: React.FC<MentorFilterDropdownProps> = ({
  users,
  onChange,
  filterOptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<{
    [key: string]: string;
  }>({});

  const handleChange = (field: string, value: string) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyFilters = () => {
    const filtered = users.filter((user) => {
      return Object.entries(selectedFilters).every(([key, value]) => {
        const typedKey = key as keyof UserType;
        const userValue = user[typedKey];

        if (typeof userValue === 'object' && userValue !== null) {
          return (userValue as { category?: string }).category === value;
        }

        return userValue === value;
      });
    });
    onChange(filtered);
  };

  const clearFilters = () => {
    setSelectedFilters({});
    onChange(users); // Reset to full user list
  };

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex w-[15%] items-center justify-between"
        >
          {/* Add the FilterListIcon and Filters text */}
          <div className="flex items-center gap-2">
            <FilterListIcon className="text-gray-700" />
            <span>Filters</span>
          </div>
          {/* Add the down arrow icon on the right */}
          {isOpen ? (
            <ArrowDropUpIcon className="text-gray-700" />
          ) : (
            <ArrowDropDownIcon className="text-gray-700" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[320px] space-y-4 rounded-md p-4 shadow-xl">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MentorFilterDropdown;
