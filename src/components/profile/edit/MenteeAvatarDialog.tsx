'use client';

import { Camera } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import {
  isPresetAvatarUrl,
  PRESET_AVATAR_URLS,
  resolveAvatarDisplayUrl,
} from '@/lib/avatar/avatarUrl';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import { validateAvatarFile } from '@/schemas/profileSchema';

const AvatarCropModal = dynamic(
  () => import('@/components/ui/avatar-crop-modal'),
  { ssr: false }
);

type AvatarDraft =
  | { kind: 'unchanged' }
  | { kind: 'preset'; url: string }
  | { kind: 'file'; file: File };

export interface MenteeAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl?: string;
  currentAvatarFile?: File;
  userName?: string;
  onSavePreset: (presetUrl: string) => void;
  onSaveCustomFile: (file: File) => void;
}

export function MenteeAvatarDialog({
  open,
  onOpenChange,
  currentAvatarUrl = '',
  currentAvatarFile,
  userName,
  onSavePreset,
  onSaveCustomFile,
}: MenteeAvatarDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<AvatarDraft>({ kind: 'unchanged' });
  const [rawSelectedFile, setRawSelectedFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft({ kind: 'unchanged' });
      setRawSelectedFile(null);
      setCropOpen(false);
      setFileError(null);
    }
    wasOpenRef.current = open;
  }, [open]);

  const activeFile = useMemo(() => {
    if (draft.kind === 'file') return draft.file;
    if (draft.kind === 'unchanged' && currentAvatarFile) {
      return currentAvatarFile;
    }
    return undefined;
  }, [currentAvatarFile, draft]);

  const filePreviewUrl = useObjectUrl(activeFile);

  const selectedPresetUrl = useMemo(() => {
    if (draft.kind === 'preset') return draft.url;
    if (draft.kind === 'file') return null;
    if (currentAvatarFile) return null;
    const normalized = resolveAvatarDisplayUrl(currentAvatarUrl, false);
    return isPresetAvatarUrl(normalized) ? normalized : null;
  }, [currentAvatarFile, currentAvatarUrl, draft]);

  const previewSrc = useMemo(() => {
    if (filePreviewUrl) return filePreviewUrl;
    if (draft.kind === 'preset') return draft.url;
    const normalized = resolveAvatarDisplayUrl(currentAvatarUrl, true);
    return normalized || DefaultAvatarImgUrl;
  }, [currentAvatarUrl, draft, filePreviewUrl]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateAvatarFile(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    setRawSelectedFile(file);
    setCropOpen(true);
  };

  const handleCropSave = (croppedBlob: Blob) => {
    const mimeType = croppedBlob.type || 'image/png';
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const croppedFile = new File([croppedBlob], `croppedAvatar.${ext}`, {
      type: mimeType,
    });
    const err = validateAvatarFile(croppedFile);
    if (err) {
      setFileError(err);
      setCropOpen(false);
      return;
    }
    setFileError(null);
    setDraft({ kind: 'file', file: croppedFile });
    setCropOpen(false);
  };

  const handleConfirmSave = () => {
    if (draft.kind === 'preset') {
      onSavePreset(draft.url);
    } else if (draft.kind === 'file') {
      onSaveCustomFile(draft.file);
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open && !cropOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && cropOpen) return;
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="animate-in fade-in-0 zoom-in-95 w-[calc(100%-32px)] max-w-lg gap-6 rounded-xl p-6 duration-200">
          <DialogHeader>
            <DialogTitle className="text-xl leading-7 font-semibold">
              編輯頭像
            </DialogTitle>
            <DialogDescription className="sr-only">
              選擇預設頭像，或點擊目前頭像上傳照片。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 pt-1">
            <div className="justify-self-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                aria-label="選擇個人照片"
                onChange={handleFileInputChange}
              />
              <button
                type="button"
                aria-label="編輯個人頭像"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'group border-brand-500/40 bg-avatar-background relative block size-[112px] cursor-pointer rounded-full border-2 p-[3px] shadow-md',
                  FOCUS_RING_NO_OFFSET_CLASSES
                )}
              >
                <span className="relative block size-full overflow-hidden rounded-full">
                  <Image
                    src={previewSrc}
                    alt={userName ? `${userName} 的頭像預覽` : '預設個人頭像'}
                    width={112}
                    height={112}
                    sizes="112px"
                    loading="eager"
                    unoptimized={typeof previewSrc === 'string'}
                    className="size-full object-cover"
                  />
                  <span className="bg-avatar-overlay text-background-white absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150 group-hover:opacity-75 group-focus-visible:opacity-75">
                    <Camera className="size-7" aria-hidden="true" />
                  </span>
                </span>
              </button>
              {fileError && (
                <p
                  role="alert"
                  className="text-status-error-default mt-2 text-center text-xs font-medium"
                >
                  {fileError}
                </p>
              )}
            </div>

            <div
              role="group"
              aria-label="預設頭像"
              className="mx-auto grid grid-cols-3 justify-center gap-3 p-1 sm:grid-cols-6"
            >
              {PRESET_AVATAR_URLS.map((presetUrl, index) => {
                const label = `預設頭像 ${index + 1}`;
                const isSelected = selectedPresetUrl === presetUrl;
                return (
                  <button
                    key={presetUrl}
                    type="button"
                    aria-label={label}
                    aria-pressed={isSelected}
                    onClick={() => setDraft({ kind: 'preset', url: presetUrl })}
                    className={cn(
                      'size-14 cursor-pointer rounded-full border-2 p-[3px] transition-colors',
                      isSelected
                        ? 'border-brand-700 bg-brand-100/40'
                        : 'hover:bg-background-bottom focus-visible:border-ring border-transparent',
                      FOCUS_RING_NO_OFFSET_CLASSES
                    )}
                  >
                    <Image
                      src={presetUrl}
                      alt=""
                      width={48}
                      height={48}
                      sizes="48px"
                      loading="eager"
                      unoptimized
                      className="size-full rounded-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="button" variant="default" onClick={handleConfirmSave}>
              儲存頭像
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cropOpen && (
        <AvatarCropModal
          file={rawSelectedFile}
          isOpen={cropOpen}
          onClose={() => setCropOpen(false)}
          onSave={handleCropSave}
        />
      )}
    </>
  );
}
