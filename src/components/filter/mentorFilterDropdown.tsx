import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserType } from '@/services/user/user';

type FilterOptions = {
  [key: string]: { label: string; value: string }[];
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
      console.log('User:', user);
      return Object.entries(selectedFilters).every(([key, value]) => {
        console.log('Filtering by:', key, value);

        const typedKey = key as keyof UserType;
        const userValue = user[typedKey];
        console.log('User Value:', userValue);

        if (typeof userValue === 'object' && userValue !== null) {
          // Handle nested structure (e.g., industry.name)
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
    <Select>
      {Object.entries(filterOptions).map(([key, options]) => (
        // show key name as label before the select
        <div key={key} className="flex flex-col gap-2 py-2">
          {' '}
          {/* Added padding between items */}
          <label className="text-black text-lg font-bold capitalize">
            {key}
          </label>{' '}
          {/* Updated label styling */}
          <Select
            value={selectedFilters[key] || ''}
            onValueChange={(val) => handleChange(key, val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`${key}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </SelectLabel>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ))}

      <div className="flex gap-4 pt-2">
        <Button onClick={applyFilters}>Apply</Button>
        <Button variant="outline" onClick={clearFilters}>
          Clear All
        </Button>
      </div>
    </Select>
  );
};

export default MentorFilterDropdown;
