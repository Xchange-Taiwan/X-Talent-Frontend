import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import { CommandEmpty, CommandGroup, CommandItem } from './command';
import { SearchableSelect } from './searchable-select';

const LOCATIONS = [
  '臺北市',
  '新北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '嘉義市',
];

const meta: Meta<typeof SearchableSelect> = {
  title: '基礎/原子元件/SearchableSelect',
  component: SearchableSelect,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '可搜尋選擇器。視窗寬度在 Tailwind `sm`（640px）以上轉譯為 popover，以下轉譯為從畫面底部升起的面板。' +
          '把 Storybook 視窗拉窄到 640px 以下即可看到面板版本。',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchableSelect>;

function LocationPicker() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

  return (
    <div className="w-full max-w-sm">
      <SearchableSelect
        open={open}
        onOpenChange={setOpen}
        title="選擇地區"
        searchPlaceholder="搜尋地區"
        trigger={
          <Button variant="outline" className="w-full justify-between">
            {value || '請選擇地區'}
          </Button>
        }
      >
        <CommandEmpty>沒有符合的選項</CommandEmpty>
        <CommandGroup>
          {LOCATIONS.map((location) => (
            <CommandItem
              key={location}
              value={location}
              onSelect={() => {
                setValue(location);
                setOpen(false);
              }}
            >
              {location}
            </CommandItem>
          ))}
        </CommandGroup>
      </SearchableSelect>
    </div>
  );
}

export const Default: Story = {
  name: '預設（依視窗寬度切換 popover / 底部面板）',
  render: () => <LocationPicker />,
};

export const MobileSheet: Story = {
  name: '手機版底部面板',
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => <LocationPicker />,
};
