'use client';

import { useSession } from 'next-auth/react';
import React from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';

import { Section } from './Section';

interface AvatarSectionProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  onFileChange?: (file: File) => void;
}

export const AvatarSection = <T extends FieldValues>({
  control,
  name,
  onFileChange,
}: AvatarSectionProps<T>) => {
  const { data: session } = useSession();
  // Avatar URLs already carry their own `?v=` cache buster from upload time,
  // so render the session value as-is — no post-hoc version stitching.
  const avatarUrl = session?.user?.avatar ?? '';

  return (
    <Section title="個人頭像">
      <AvatarUpload
        control={control}
        name={name}
        avatarUrl={avatarUrl}
        onFileChange={onFileChange}
      />
    </Section>
  );
};
