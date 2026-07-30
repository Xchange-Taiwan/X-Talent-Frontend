import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DeleteAccountMode } from '@/hooks/auth/useDeleteAccountForm';
import { DeleteAccountXCSchema } from '@/schemas/auth';

import { DeleteAccountDialogView } from './DeleteAccountDialog';

const meta: Meta<typeof DeleteAccountDialogView> = {
  title: 'Components/Auth/DeleteAccountDialog',
  component: DeleteAccountDialogView,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof DeleteAccountDialogView>;

interface DialogWrapperProps {
  mode: DeleteAccountMode;
  isSubmitting?: boolean;
  blockedByReservations?: boolean;
}

const DialogWrapper = ({
  mode,
  isSubmitting = false,
  blockedByReservations = false,
}: DialogWrapperProps) => {
  const xcForm = useForm<z.infer<typeof DeleteAccountXCSchema>>({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: 'talent@xchange.tw', password: '' },
  });

  return (
    <DeleteAccountDialogView
      open={true}
      onOpenChange={() => {}}
      mode={mode}
      xcForm={xcForm}
      isSubmitting={isSubmitting}
      blockedByReservations={blockedByReservations}
      onSubmitXC={async (values) => {
        alert(`Submit: ${JSON.stringify(values)}`);
      }}
      initiateGoogleReauth={async () => {
        alert('Initiate Google reauth');
      }}
    />
  );
};

export const PasswordDelete: Story = {
  render: () => <DialogWrapper mode="xc" />,
};

export const PasswordDeleteSubmitting: Story = {
  render: () => <DialogWrapper mode="xc" isSubmitting={true} />,
};

export const GoogleDelete: Story = {
  render: () => <DialogWrapper mode="google" />,
};

export const GoogleDeleteSubmitting: Story = {
  render: () => <DialogWrapper mode="google" isSubmitting={true} />,
};

export const BlockedByReservations: Story = {
  render: () => <DialogWrapper mode="xc" blockedByReservations={true} />,
};
