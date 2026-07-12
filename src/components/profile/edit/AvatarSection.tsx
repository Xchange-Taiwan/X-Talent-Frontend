'use client';

import { useSession } from 'next-auth/react';
import React from 'react';
import { Control, FieldValues, Path, useFormState } from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';

import { Section } from './Section';

interface AvatarSectionProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  onFileChange?: (file: File) => void;
  isMentor?: boolean;
  id?: string;
}

export const AvatarSection = <T extends FieldValues>({
  control,
  name,
  onFileChange,
  isMentor,
  id,
}: AvatarSectionProps<T>) => {
  const { data: session } = useSession();
  const { errors } = useFormState({ control });
  // Avatar URLs already carry their own `?v=` cache buster from upload time,
  // so render the session value as-is — no post-hoc version stitching.
  const avatarUrl = session?.user?.avatar ?? '';
  const avatarErrorMessage = errors[name]?.message as string | undefined;

  return (
    <Section
      id={id}
      title={
        <>
          {isMentor && <span className="text-status-200">* </span>}
          個人頭像
        </>
      }
    >
      <AvatarUpload
        control={control}
        name={name}
        avatarUrl={avatarUrl}
        onFileChange={onFileChange}
        hasError={!!avatarErrorMessage}
      />
      {avatarErrorMessage && (
        <p className="mt-2 text-center text-sm font-medium text-destructive lg:text-left">
          {avatarErrorMessage}
        </p>
      )}
    </Section>
  );
};
