'use client';

import { Camera } from 'lucide-react';
import Image from 'next/image';
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
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { resolveAvatarDisplayUrl } from '@/lib/avatar/avatarUrl';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

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
  variant?: 'default' | 'card' | 'compact';
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
      ? resolveAvatarDisplayUrl(watchedAvatar)
      : resolveAvatarDisplayUrl(session?.user?.avatar ?? '');

  const currentFile =
    typeof File !== 'undefined' && (watchedFile as unknown) instanceof File
      ? (watchedFile as unknown as File)
      : undefined;

  const customFilePreviewUrl = useObjectUrl(currentFile);
  const effectiveDisplayUrl =
    customFilePreviewUrl ??
    (avatarUrl || resolveAvatarDisplayUrl(undefined, !isMentor));

  if (variant === 'compact') {
    if (!isMentor && onSelectPresetAvatar) {
      return (
        <div id={id} className="relative inline-block shrink-0 p-0.5">
          <button
            type="button"
            aria-label="點擊編輯頭像"
            onClick={() => setPresetDialogOpen(true)}
            className={cn(
              FOCUS_RING_NO_OFFSET_CLASSES,
              'group border-background-border relative block size-24 cursor-pointer overflow-hidden rounded-full border-2 shadow-xs'
            )}
          >
            <Image
              src={effectiveDisplayUrl}
              alt={userName ? `${userName} 的個人頭像` : '個人頭像'}
              fill
              sizes="96px"
              loading="eager"
              unoptimized
              className="object-cover"
            />
            <span className="bg-dark/35 text-background-white group-hover:bg-dark/50 absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-6" aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            aria-label="編輯頭像"
            onClick={() => setPresetDialogOpen(true)}
            className={cn(
              FOCUS_RING_NO_OFFSET_CLASSES,
              'border-background-border bg-background-white text-text-secondary hover:text-text-primary absolute right-0.5 bottom-0.5 grid size-8 cursor-pointer place-items-center rounded-full border shadow-xs transition-colors'
            )}
          >
            <Camera className="size-4" aria-hidden="true" />
          </button>

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
        </div>
      );
    }

    return (
      <div id={id} className="shrink-0 p-0.5">
        <AvatarUpload
          control={control}
          name={name}
          avatarUrl={
            customFilePreviewUrl ??
            (avatarUrl || resolveAvatarDisplayUrl(undefined, true))
          }
          onFileChange={onFileChange}
          compact
        />
      </div>
    );
  }

  if (!isMentor && onSelectPresetAvatar) {
    return (
      <Section id={id} title="個人頭像" required={false} variant={variant}>
        <div className="flex items-center gap-4 p-0.5">
          <button
            type="button"
            aria-label="點擊編輯頭像"
            onClick={() => setPresetDialogOpen(true)}
            className={cn(
              FOCUS_RING_NO_OFFSET_CLASSES,
              'group border-background-border relative block size-24 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 shadow-sm'
            )}
          >
            <Image
              src={effectiveDisplayUrl}
              alt={userName ? `${userName} 的個人頭像` : '個人頭像'}
              fill
              sizes="96px"
              loading="eager"
              unoptimized
              className="object-cover"
            />
            <span className="bg-dark/35 text-background-white group-hover:bg-dark/50 absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-6" aria-hidden="true" />
            </span>
          </button>

          <div className="flex flex-col items-start gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-4"
              onClick={() => setPresetDialogOpen(true)}
            >
              編輯頭像
            </Button>
            <p className="text-text-tertiary text-xs">
              可選擇預設插畫頭像或自行上傳照片
            </p>
          </div>

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
        </div>
      </Section>
    );
  }

  return (
    <Section id={id} title="個人頭像" required={isMentor} variant={variant}>
      <div className="flex flex-col items-start gap-3">
        <AvatarUpload
          control={control}
          name={name}
          avatarUrl={customFilePreviewUrl ?? avatarUrl}
          onFileChange={onFileChange}
        />
      </div>
    </Section>
  );
};
