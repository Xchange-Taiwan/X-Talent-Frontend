'use client';

import { useSession } from 'next-auth/react';
import React, { useRef } from 'react';
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
  // Stable fallback used when avatarUpdatedAt is absent (e.g. fresh login
  // before any update). Ensures the browser fetches the current image on
  // first load rather than serving a previously-cached ?cb=0 stale copy.
  const stableCacheBust = useRef(Date.now()).current;

  const sessionAvatar = session?.user?.avatar ?? '';
  const avatarUrl = sessionAvatar
    ? `${sessionAvatar}?cb=${session?.user?.avatarUpdatedAt ?? stableCacheBust}`
    : '';

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
