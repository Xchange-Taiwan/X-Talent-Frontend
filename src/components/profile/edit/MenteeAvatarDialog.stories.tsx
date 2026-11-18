import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';

import { MenteeAvatarDialog } from './MenteeAvatarDialog';

const meta: Meta<typeof MenteeAvatarDialog> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/MenteeAvatarDialog',
  component: MenteeAvatarDialog,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof MenteeAvatarDialog>;

function DialogDemo({ initialUrl = '' }: { initialUrl?: string }) {
  const [open, setOpen] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(initialUrl);
  const [customFile, setCustomFile] = useState<File | undefined>(undefined);

  return (
    <div className="p-6">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        開啟編輯頭像視窗
      </Button>
      <MenteeAvatarDialog
        open={open}
        onOpenChange={setOpen}
        currentAvatarUrl={avatarUrl}
        currentAvatarFile={customFile}
        userName="陳大明 Alex Chen"
        onSavePreset={(url) => {
          setCustomFile(undefined);
          setAvatarUrl(url);
        }}
        onSaveCustomFile={(file) => {
          setCustomFile(file);
        }}
      />
    </div>
  );
}

export const DefaultUnselected: Story = {
  name: '尚未選擇頭像（顯示預設頭像佔位）',
  render: () => <DialogDemo initialUrl="" />,
};

export const PresetSelected: Story = {
  name: '已選擇預設插畫頭像',
  render: () => <DialogDemo initialUrl="/avatars/default_1.webp" />,
};
