import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import AvatarCropModal from './avatar-crop-modal';
import { Button } from './button';

const meta: Meta<typeof AvatarCropModal> = {
  title: 'Components/UI/AvatarCropModal',
  component: AvatarCropModal,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AvatarCropModal>;

const AvatarCropModalWrapper = () => {
  const [isOpen, setIsOpen] = useState(false);
  // Create a mock File object to pass
  const [mockFile] = useState<File>(() => {
    const blob = new Blob([''], { type: 'image/png' });
    return new File([blob], 'avatar.png', { type: 'image/png' });
  });

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>開啟裁剪視窗</Button>
      {isOpen && (
        <AvatarCropModal
          file={mockFile}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={(blob) => {
            console.log('Saved blob:', blob);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
};

export const Default: Story = {
  render: () => <AvatarCropModalWrapper />,
};
