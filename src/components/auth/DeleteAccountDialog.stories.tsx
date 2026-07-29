import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import useDeleteAccountForm, {
  DeleteAccountMode,
} from '@/hooks/auth/useDeleteAccountForm';
import { DeleteAccountXCSchema } from '@/schemas/auth';

import { DeleteAccountDialog } from './DeleteAccountDialog';

const meta: Meta<typeof DeleteAccountDialog> = {
  title: 'Components/Auth/DeleteAccountDialog',
  component: DeleteAccountDialog,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DeleteAccountDialog>;

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
  const xcForm = useForm({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: 'talent@xchange.tw', password: '' },
  });

  React.useEffect(() => {
    (useDeleteAccountForm as any).mock = () => ({
      mode,
      xcForm,
      isSubmitting,
      blockedByReservations,
      onSubmitXC: async (values: any) => {
        alert(`Submit: ${JSON.stringify(values)}`);
      },
      initiateGoogleReauth: async () => {
        alert('Initiate Google reauth');
      },
    });

    return () => {
      (useDeleteAccountForm as any).mock = undefined;
    };
  }, [mode, isSubmitting, blockedByReservations, xcForm]);

  return <DeleteAccountDialog open={true} onOpenChange={() => {}} />;
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
