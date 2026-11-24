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
import {
  resolveAvatarDisplayUrl,
  shouldUnoptimizeAvatarSrc,
  withAvatarVersion,
} from '@/lib/avatar/avatarUrl';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import { MenteeAvatarDialog } from './MenteeAvatarDialog';
import { Section } from './Section';

function MenteeAvatarTriggerButton({
  src,
  userName,
  onClick,
}: {
  src: string;
  userName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="點擊編輯頭像"
      onClick={onClick}
      className={cn(
        FOCUS_RING_NO_OFFSET_CLASSES,
        'group border-background-border relative block size-16 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 shadow-xs sm:size-[88px]'
      )}
    >
      <Image
        src={src}
        alt={userName ? `${userName} 的個人頭像` : '個人頭像'}
        fill
        sizes="88px"
        loading="eager"
        unoptimized={shouldUnoptimizeAvatarSrc(src)}
        className="object-cover"
      />
      <span className="bg-avatar-overlay text-background-white absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-75">
        <Camera className="size-6" aria-hidden="true" />
      </span>
    </button>
  );
}

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
  // #981: avatar upload failures surface as a field error on `name`
  // (see avatarUploadFailure.ts). The Mentor branch renders it through
  // AvatarUpload; the Mentee branch must render it here, otherwise the
  // failure is silent now that the generic toast is suppressed.
  const { errors } = useFormState({ control, name });
  const fieldErrorMessage = (
    errors as Record<string, { message?: unknown } | undefined>
  )[String(name)]?.message;
  const menteeErrorMessage =
    typeof fieldErrorMessage === 'string' && fieldErrorMessage.length > 0
      ? fieldErrorMessage
      : undefined;
  const menteeError = menteeErrorMessage ? (
    <p
      role="alert"
      data-testid="mentee-avatar-error"
      className="text-status-error-default text-sm font-medium"
    >
      {menteeErrorMessage}
    </p>
  ) : null;

  const isAvatarDirty = Boolean(
    (dirtyFields as Record<string, unknown>)[String(resolvedAvatarField)]
  );
  const rawAvatarUrl =
    typeof watchedAvatar === 'string' &&
    (watchedAvatar.length > 0 || isAvatarDirty)
      ? resolveAvatarDisplayUrl(watchedAvatar)
      : resolveAvatarDisplayUrl(session?.user?.avatar ?? '');
  const avatarUrl = rawAvatarUrl
    ? withAvatarVersion(rawAvatarUrl, session?.user?.avatarUpdatedAt, 'cb')
    : '';

  const currentFile =
    typeof File !== 'undefined' && (watchedFile as unknown) instanceof File
      ? (watchedFile as unknown as File)
      : undefined;

  const customFilePreviewUrl = useObjectUrl(currentFile);
  const effectiveDisplayUrl =
    customFilePreviewUrl ??
    (avatarUrl || resolveAvatarDisplayUrl(undefined, !isMentor));

  if (!isMentor && onSelectPresetAvatar) {
    const openDialog = () => setPresetDialogOpen(true);

    return (
      <>
        {variant === 'compact' ? (
          <div
            id={id}
            className="inline-flex shrink-0 flex-col items-start gap-2"
          >
            <div className="relative inline-block p-0.5">
              <MenteeAvatarTriggerButton
                src={effectiveDisplayUrl}
                userName={userName}
                onClick={openDialog}
              />
              <button
                type="button"
                aria-label="編輯頭像"
                onClick={openDialog}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'border-background-border bg-background-white text-text-secondary hover:text-text-primary absolute right-0.5 bottom-0.5 grid size-8 cursor-pointer place-items-center rounded-full border shadow-xs transition-colors'
                )}
              >
                <Camera className="size-4" aria-hidden="true" />
              </button>
            </div>
            {menteeError}
          </div>
        ) : (
          <Section id={id} title="個人頭像" required={false} variant={variant}>
            <div className="flex items-center gap-4 p-0.5">
              <MenteeAvatarTriggerButton
                src={effectiveDisplayUrl}
                userName={userName}
                onClick={openDialog}
              />
              <div className="flex flex-col items-start gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={openDialog}
                >
                  編輯頭像
                </Button>
                <p className="text-text-tertiary text-xs">
                  可選擇預設插畫頭像或自行上傳照片
                </p>
                {menteeError}
              </div>
            </div>
          </Section>
        )}

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
    );
  }

  if (variant === 'compact') {
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
