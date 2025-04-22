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
      <label className="text-black text-sm font-medium capitalize">
        {name}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${name}`} />
        </SelectTrigger>
        <SelectContent>
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
