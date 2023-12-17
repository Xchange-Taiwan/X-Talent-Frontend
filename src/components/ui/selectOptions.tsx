import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons';
import * as Select from '@radix-ui/react-select';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface SelectItemProps {
  children: React.ReactNode;
  className?: string;
  value: string;
}

interface SelectItemDataType {
  label: string;
  placeholder: string;
  options: string[];
}

interface SelectOptionsProps {
  selectItemData: SelectItemDataType;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <Select.Item
        className={cn(
          'data-[disabled]:text-mauve8 relative flex h-[25px] select-none items-center rounded-[3px] pl-[25px] pr-[35px] text-[13px] leading-none text-black data-[disabled]:pointer-events-none data-[highlighted]:bg-primary data-[highlighted]:text-white data-[highlighted]:outline-none',
          className,
        )}
        {...props}
        ref={ref}
      >
        <Select.ItemText>{children}</Select.ItemText>
        <Select.ItemIndicator className="absolute left-0 inline-flex w-[25px] items-center justify-center">
          <CheckIcon />
        </Select.ItemIndicator>
      </Select.Item>
    );
  },
);
SelectItem.displayName = 'SelectItem';

const SelectOptions = React.forwardRef<HTMLDivElement, SelectOptionsProps>(
  ({ selectItemData }) => {
    return (
      <Select.Root>
        <Select.Trigger
          className="text-violet11 inline-flex h-10 items-center gap-[5px] rounded border border-input px-3 py-2 text-sm leading-none outline-none data-[placeholder]:text-muted-foreground"
          aria-label="Food"
        >
          <Select.Value placeholder={selectItemData.placeholder} />
          <Select.Icon className="text-violet11 ml-auto">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="bg-light z-[60] overflow-hidden rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]">
            <Select.ScrollUpButton className="text-violet11 bg-light flex h-[25px] cursor-default items-center justify-center">
              <ChevronUpIcon />
            </Select.ScrollUpButton>
            <Select.Viewport className="p-[5px]">
              <Select.Group>
                <Select.Label className="px-[25px] text-xs leading-[25px] text-muted-foreground">
                  {selectItemData.label}
                </Select.Label>
                {selectItemData.options.map((option) => {
                  return (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  );
                })}
              </Select.Group>
            </Select.Viewport>
            <Select.ScrollDownButton className="text-violet11 bg-light flex h-[25px] cursor-default items-center justify-center">
              <ChevronDownIcon />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    );
  },
);
SelectOptions.displayName = 'SelectOptions';

export { SelectOptions };
