import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import { Toaster } from './toaster';
import { useToast } from './use-toast';

const meta: Meta<typeof Toaster> = {
  title: 'Components/UI/Toaster',
  component: Toaster,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Toaster>;

const ToasterDemo = () => {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Button
          onClick={() =>
            toast({
              title: '更新成功',
              description: '導師個人資料已成功儲存。',
            })
          }
        >
          成功通知 (Success)
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            toast({
              variant: 'destructive',
              title: '儲存失敗',
              description: '伺服器發生異常錯誤，請重新整理頁面再試一次。',
            })
          }
        >
          錯誤通知 (Error)
        </Button>
      </div>
      {/* Render the Toaster inside the story context */}
      <Toaster />
    </div>
  );
};

export const Default: Story = {
  render: () => <ToasterDemo />,
};
