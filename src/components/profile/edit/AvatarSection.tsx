'use client';

import { useSession } from 'next-auth/react';
import React from 'react';
import { Control, FieldValues, Path, useWatch } from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';

import { Section } from './Section';

interface AvatarSectionProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  avatarUrlField?: Path<T>;
  onFileChange?: (file: File) => void;
  isMentor?: boolean;
  id?: string;
}

export const AvatarSection = <T extends FieldValues>({
  control,
  name,
  avatarUrlField,
  onFileChange,
  isMentor,
  id,
}: AvatarSectionProps<T>) => {
  const { data: session } = useSession();
  const watchedAvatar = useWatch({
    control,
    name: avatarUrlField ?? ('avatar' as Path<T>),
  });
  const avatarUrl =
    typeof watchedAvatar === 'string'
      ? watchedAvatar
      : (session?.user?.avatar ?? '');

  return (
    <Section id={id} title="個人頭像" required={isMentor}>
      <AvatarUpload
        control={control}
        name={name}
        avatarUrl={avatarUrl}
        onFileChange={onFileChange}
      />
    </Section>
  );
};
