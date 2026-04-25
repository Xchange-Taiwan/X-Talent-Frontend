'use client';

import React from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';

import { Section } from './Section';

interface AvatarSectionProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  avatarUrl: string;
}

export const AvatarSection = <T extends FieldValues>({
  control,
  name,
  avatarUrl,
}: AvatarSectionProps<T>) => (
  <Section title="個人頭像">
    <AvatarUpload control={control} name={name} avatarUrl={avatarUrl} />
  </Section>
);
