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
          <DropdownMenuItem>個人檔案 (Profile)</DropdownMenuItem>
          <DropdownMenuItem>帳戶與設定 (Settings)</DropdownMenuItem>
          <DropdownMenuItem>我的預約 (My Bookings)</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            切換身分 (Change Role)
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>切換為導師 (Mentor)</DropdownMenuItem>
            <DropdownMenuItem>切換為學員 (Mentee)</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-status-error-default">
          登出 (Logout)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
