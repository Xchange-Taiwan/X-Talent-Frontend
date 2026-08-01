import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command';

const meta: Meta<typeof Command> = {
  title: '基礎/原子元件/Command',
  component: Command,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Command>;

export const Default: Story = {
  render: () => (
    <div className="max-w-md rounded-lg border shadow-md">
      <Command>
        <CommandInput placeholder="搜尋導師、技能或主題..." />
        <CommandList>
          <CommandEmpty>找不到相符的導師、技能或主題。</CommandEmpty>
          <CommandGroup heading="熱門推薦導師">
            <CommandItem>林小明 (Google 資深前端工程師)</CommandItem>
            <CommandItem>陳美玲 (LINE 產品經理)</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="熱門主題">
            <CommandItem>職涯規劃與模擬面試</CommandItem>
            <CommandItem>前端效能優化與 React</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="功能選單">
            <CommandItem>切換至導師後台</CommandItem>
            <CommandItem>編輯個人設定</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
};
