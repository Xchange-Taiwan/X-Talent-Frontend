'use client';

import { useSession } from 'next-auth/react';
import React, { useState } from 'react';
import {
  Control,
  FieldValues,
  Path,
  useFormState,
  useWatch,
} from 'react-hook-form';

import AvatarUpload from '@/components/ui/avatar-upload';
import { Button } from '@/components/ui/button';

import { MenteeAvatarDialog } from './MenteeAvatarDialog';
import { Section } from './Section';

interface AvatarSectionProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  avatarUrlField?: Path<T>;
  onFileChange?: (file: File) => void;
  onSelectPresetAvatar?: (presetUrl: string) => void;
  userName?: string;
  isMentor?: boolean;
  variant?: 'default' | 'card';
  id?: string;
}

export const AvatarSection = <T extends FieldValues>({
  control,
  name,
  avatarUrlField,
  onFileChange,
  onSelectPresetAvatar,
  userName,
  isMentor,
  variant = 'default',
  id,
}: AvatarSectionProps<T>) => {
  const { data: session } = useSession();
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  const resolvedAvatarField = avatarUrlField ?? ('avatar' as Path<T>);
  const watchedAvatar = useWatch({
    control,
    name: resolvedAvatarField,
  });
  const watchedFile = useWatch({
    control,
    name,
  });
  const { dirtyFields } = useFormState({
    control,
    name: resolvedAvatarField,
  });
  const isAvatarDirty = Boolean(
    (dirtyFields as Record<string, unknown>)[String(resolvedAvatarField)]
  );
  const avatarUrl =
    typeof watchedAvatar === 'string' &&
    (watchedAvatar.length > 0 || isAvatarDirty)
      ? watchedAvatar
      : (session?.user?.avatar ?? '');

  const currentFile =
    typeof File !== 'undefined' && (watchedFile as unknown) instanceof File
      ? (watchedFile as unknown as File)
      : undefined;

  return (
    <Section id={id} title="個人頭像" required={isMentor} variant={variant}>
      <div className="flex flex-col items-start gap-3">
        <AvatarUpload
          control={control}
          name={name}
          avatarUrl={avatarUrl}
          onFileChange={onFileChange}
        />

        {!isMentor && onSelectPresetAvatar && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-4"
              onClick={() => setPresetDialogOpen(true)}
            >
              選擇預設插畫頭像
            </Button>

            <MenteeAvatarDialog
              open={presetDialogOpen}
              onOpenChange={setPresetDialogOpen}
              currentAvatarUrl={avatarUrl}
              currentAvatarFile={currentFile}
              userName={userName}
              onSavePreset={(presetUrl) => {
                onSelectPresetAvatar(presetUrl);
              }}
              onSaveCustomFile={(file) => {
                onFileChange?.(file);
              }}
            />
          </>
        )}
      </div>
    </Section>
  );
};
