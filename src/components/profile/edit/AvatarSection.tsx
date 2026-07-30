'use client';

import { useSession } from 'next-auth/react';
import React from 'react';
import { Control } from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';

import { Section } from './Section';

interface AvatarSectionProps {
  control: Control<any>;
  name: string;
  onFileChange?: (file: File) => void;
  isMentor?: boolean;
  id?: string;
}

export const AvatarSection = ({
  control,
  name,
  onFileChange,
  isMentor,
  id,
}: AvatarSectionProps) => {
  const { data: session } = useSession();
  // Avatar URLs already carry their own `?v=` cache buster from upload time,
  // so render the session value as-is — no post-hoc version stitching.
  const avatarUrl = session?.user?.avatar ?? '';

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
