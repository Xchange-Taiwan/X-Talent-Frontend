import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDown, X, XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Lazy-load the dropdown content (Command / cmdk) so it is not included in
// the initial bundle. PopoverContent only mounts when the popover is open,
// so the chunk is only fetched the first time a user opens any MultiSelect.
const MultiSelectDropdown = dynamic(
  () => import('@/components/ui/multi-select-dropdown'),
  { ssr: false }
);

/**
 * Variants for the multi-select component to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on "variant" prop.
 */
const multiSelectVariants = cva(
  'm-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300',
  {
    variants: {
      variant: {
        default:
          'border-foreground/10 text-foreground bg-card hover:bg-card/80',
        secondary:
          'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        primaryAlt: 'primaryAlt',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Props for MultiSelect component
 */
interface MultiSelectProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'>,
    VariantProps<typeof multiSelectVariants> {
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  onValueChange?: (value: string[]) => void;
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
  placeholder?: string;
  animation?: number;
  maxCount?: number;
  modalPopover?: boolean;
  asChild?: boolean;
  className?: string;
  value?: string[];
}

export const MultiSelect = React.forwardRef<
  HTMLButtonElement,
  MultiSelectProps
>(
  (
    {
      options,
      onValueChange,
      variant,
      defaultValue = [],
      value,
      placeholder = 'Select options',
      animation = 0,
      maxCount = 3,
      modalPopover = false,
      className,
      ...props
    },
    ref
  ) => {
    const [internalSelectedValues, setInternalSelectedValues] =
      React.useState<string[]>(defaultValue);

    const selectedValues = value ?? internalSelectedValues;

    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

    const updateValues = (newValues: string[]) => {
      if (value === undefined) {
        setInternalSelectedValues(newValues);
      }
      if (onValueChange) {
        onValueChange(newValues);
      } else if (props.onChange) {
        props.onChange(newValues);
      }
    };

    const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      if (event.key === 'Enter') {
        setIsPopoverOpen(true);
      } else if (event.key === 'Backspace' && !event.currentTarget.value) {
        const newSelectedValues = [...selectedValues];
        newSelectedValues.pop();
        updateValues(newSelectedValues);
      }
    };

    const toggleOption = (option: string) => {
      const newSelectedValues = selectedValues.includes(option)
        ? selectedValues.filter((v) => v !== option)
        : [...selectedValues, option];
      updateValues(newSelectedValues);
    };

    const handleClear = () => updateValues([]);

    const clearExtraOptions = () =>
      updateValues(selectedValues.slice(0, maxCount));

    const toggleAll = () => {
      if (selectedValues.length === options.length) {
        handleClear();
      } else {
        updateValues(options.map((o) => o.value));
      }
    };

    const handleTogglePopover = () => setIsPopoverOpen((prev) => !prev);

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            onClick={handleTogglePopover}
            className={cn(
              'bg-inherit hover:bg-inherit flex h-auto min-h-10 w-full items-center justify-between rounded-md border p-1 [&_svg]:pointer-events-auto',
              className
            )}
            variant={variant}
          >
            {selectedValues.length > 0 ? (
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-wrap items-center">
                  {selectedValues.slice(0, maxCount).map((val) => {
                    const option = options.find((o) => o.value === val);
                    const IconComponent = option?.icon;
                    return (
                      <Badge
                        key={val}
                        className={cn(multiSelectVariants({ variant }))}
                        style={{ animationDuration: `${animation}s` }}
                        variant={variant}
                      >
                        {IconComponent && (
                          <IconComponent className="mr-2 h-4 w-4" />
                        )}
                        {option?.label}
                        <X
                          className="ml-2 h-4 w-4 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOption(val);
                          }}
                        />
                      </Badge>
                    );
                  })}
                  {selectedValues.length > maxCount && (
                    <Badge
                      className={cn(
                        'bg-transparent border-foreground/1 hover:bg-transparent text-foreground',
                        multiSelectVariants({ variant })
                      )}
                      style={{ animationDuration: `${animation}s` }}
                    >
                      {`+ ${selectedValues.length - maxCount} more`}
                      <X
                        className="ml-2 h-4 w-4 cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearExtraOptions();
                        }}
                      />
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <XIcon
                    className="mx-2 h-4 cursor-pointer text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClear();
                    }}
                  />
                  <Separator
                    orientation="vertical"
                    className="flex h-full min-h-6"
                  />
                  <ChevronDown className="mx-2 h-4 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full items-center justify-between">
                <span className="mx-3 text-sm text-muted-foreground">
                  {placeholder}
                </span>
                <ChevronDown className="mx-2 h-4 cursor-pointer text-muted-foreground" />
              </div>
            )}
          </Button>
        </PopoverTrigger>

        {/* PopoverContent only mounts when open — MultiSelectDropdown (cmdk) is
            therefore only fetched on first user interaction with the dropdown */}
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <MultiSelectDropdown
            options={options}
            selectedValues={selectedValues}
            onInputKeyDown={handleInputKeyDown}
            onToggleOption={toggleOption}
            onToggleAll={toggleAll}
            onClear={handleClear}
            onClose={() => setIsPopoverOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  }
);

MultiSelect.displayName = 'MultiSelect';
