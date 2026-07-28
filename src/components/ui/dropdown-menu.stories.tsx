import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Components/UI/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">個人選單</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem>個人檔案</DropdownMenuItem>
          <DropdownMenuItem>帳戶與設定</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>邀請好友</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>透過 Email 邀請</DropdownMenuItem>
            <DropdownMenuItem>複製邀請連結</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">登出</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
