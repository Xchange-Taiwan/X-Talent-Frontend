import type { JSX } from 'react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterSelectProps {
  name: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
}

function FilterSelect({
  name,
  value,
  options,
  onChange,
}: FilterSelectProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium capitalize text-text-primary">
        {name}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`請選擇${name}`} />
        </SelectTrigger>

        <SelectContent className="z-[60]">
          <SelectGroup>
            <SelectLabel>{name}</SelectLabel>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default FilterSelect;
