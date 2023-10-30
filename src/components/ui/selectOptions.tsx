import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
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
          'text-[13px] leading-none text-black rounded-[3px] flex items-center h-[25px] pr-[35px] pl-[25px] relative select-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:outline-none data-[highlighted]:bg-primary data-[highlighted]:text-white',
          className
        )}
        {...props}
        ref={ref}
      >
        <Select.ItemText>{children}</Select.ItemText>
        <Select.ItemIndicator className="absolute left-0 w-[25px] inline-flex items-center justify-center">
          <CheckIcon />
        </Select.ItemIndicator>
      </Select.Item>
    );
  }
);
SelectItem.displayName = 'SelectItem';

const SelectOptions = React.forwardRef<HTMLDivElement, SelectOptionsProps>(
  ({ selectItemData }) => {
    return (
      <Select.Root>
        <Select.Trigger
          className="inline-flex border border-input items-center rounded px-3 py-2 text-sm leading-none h-10 gap-[5px] text-violet11 outline-none data-[placeholder]:text-muted-foreground"
          aria-label="Food"
        >
          <Select.Value placeholder={selectItemData.placeholder} />
          <Select.Icon className="ml-auto text-violet11">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="z-[60] overflow-hidden bg-white rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]">
            <Select.ScrollUpButton className="flex items-center justify-center h-[25px] bg-white text-violet11 cursor-default">
              <ChevronUpIcon />
            </Select.ScrollUpButton>
            <Select.Viewport className="p-[5px]">
              <Select.Group>
                <Select.Label className="px-[25px] text-xs leading-[25px] text-muted-foreground">
                  {selectItemData.label}
                </Select.Label>
                {selectItemData.options.map((option) => {
                  return <SelectItem key={option} value={option}>{option}</SelectItem>;
                })}
              </Select.Group>
            </Select.Viewport>
            <Select.ScrollDownButton className="flex items-center justify-center h-[25px] bg-white text-violet11 cursor-default">
              <ChevronDownIcon />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    );
  }
)
SelectOptions.displayName = 'SelectOptions';

export { SelectOptions };

