import { ArrowDownUp } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const SortingDropdown = ({
  onSortChange,
}: {
  onSortChange: (sortMethod: string) => void;
}) => {
  return (
    <Select defaultValue="a-z" onValueChange={onSortChange}>
      <SelectTrigger>
        <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="sorting" />
      </SelectTrigger>
      <SelectContent className="w-fit">
        <SelectGroup>
          <SelectLabel>Sort By</SelectLabel>
          <SelectItem value="a-z">A - Z</SelectItem>
          <SelectItem value="z-a">Z - A (中文排序)</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default SortingDropdown;
