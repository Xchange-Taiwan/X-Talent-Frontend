import { useState } from 'react';

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
type FilterableUserField = keyof UserType;
interface MinorFilterDropdownProps {
  options: { label: string; value: string }[];
  onChange: (filteredUsers: UserType[]) => void;
  users: UserType[];
  filterField: FilterableUserField;
}

const MinorFilterDropdown: React.FC<MinorFilterDropdownProps> = ({
  options,
  onChange,
  users,
  filterField,
}) => {
  const [selectedValue, setSelectedValue] = useState<string>('');

  const handleSelectChange = (value: string) => {
    setSelectedValue(value);
    const filteredUsers = users.filter((user) => user[filterField] === value);
    onChange(filteredUsers);
  };

  return (
    <Select value={selectedValue} onValueChange={handleSelectChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Options</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default MinorFilterDropdown;
