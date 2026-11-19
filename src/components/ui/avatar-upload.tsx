import { Camera, ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Control, FieldValues, Path, useController } from 'react-hook-form';

import { useObjectUrl } from '@/hooks/useObjectUrl';
import { shouldUnoptimizeAvatarSrc } from '@/lib/avatar/avatarUrl';
import {
  FOCUS_RING_CLASSES,
  FOCUS_RING_NO_OFFSET_CLASSES,
} from '@/lib/ui/focusRing';

// Lazy-load the crop modal — it pulls in react-avatar-editor and Radix UI components
// (~100kB+), which are only needed when the user actually opens the crop dialog.
const AvatarCropModal = dynamic(() => import('./avatar-crop-modal'), {
  ssr: false,
});

interface AvatarUploadProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  avatarUrl?: string;
  onFileChange?: (file: File) => void;
  compact?: boolean;
}

const AvatarUpload = <T extends FieldValues>({
  control,
  name,
  avatarUrl,
  onFileChange,
  compact = false,
}: AvatarUploadProps<T>) => {
  const { field, fieldState } = useController({ control, name });
  const errorMessage = fieldState.error?.message;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentFile =
    typeof File !== 'undefined' && (field.value as unknown) instanceof File
      ? (field.value as unknown as File)
      : undefined;
  const blobPreviewUrl = useObjectUrl(currentFile);
  const imagePreviewUrl = blobPreviewUrl ?? avatarUrl;

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);

  const handleUploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      setSelectedImage(file);
      setOpen(true);
    }
  };

  const handleSaveImage = (croppedImageBlob: Blob) => {
    if (croppedImageBlob) {
      const mimeType = croppedImageBlob.type || 'image/png';
      const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const croppedFile = new File([croppedImageBlob], `croppedAvatar.${ext}`, {
        type: mimeType,
      });
      field.onChange(croppedFile);
      setSelectedImage(croppedFile);
      onFileChange?.(croppedFile);
    }
  };

  return (
    <div
      className={
        compact
          ? 'relative inline-flex flex-col items-center'
          : 'mb-10 flex flex-col items-center lg:items-start'
      }
    >
      <div className="relative inline-block">
        <div
          className={`group bg-avatar-background relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 ${
            compact
              ? 'size-16 shadow-xs sm:size-[88px]'
              : 'size-36 lg:h-[150px] lg:w-[150px]'
          } ${
            errorMessage
              ? 'border-status-error-default'
              : 'border-avatar-border'
          } ${compact ? FOCUS_RING_NO_OFFSET_CLASSES : FOCUS_RING_CLASSES}`}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          aria-label="點擊上傳或更換頭像"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleUploadAvatar}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Hover show upload icon */}
          <div className="bg-dark/35 text-background-white absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Camera size={compact ? 22 : 50} />
          </div>

          {imagePreviewUrl ? (
            <Image
              src={imagePreviewUrl}
              alt="Avatar Preview"
              width={compact ? 88 : 150}
              height={compact ? 88 : 150}
              sizes={compact ? '88px' : '150px'}
              unoptimized={shouldUnoptimizeAvatarSrc(imagePreviewUrl)}
              className="size-full rounded-full object-cover"
              priority
            />
          ) : (
            // Show default avatar if no image is selected
            <ImageIcon
              size={compact ? 28 : 50}
              className="text-avatar-border"
            />
          )}
        </div>
      </div>
      {errorMessage && (
        <p className="text-status-error-default mt-2 text-center text-sm font-medium lg:text-left">
          {errorMessage}
        </p>
      )}

      {/* Rendered outside the trigger div — nesting it inside would let clicks
          inside the modal (e.g. releasing a drag on the editor canvas) bubble
          through the React tree to the trigger's onClick and reopen the file
          picker, even though the modal itself portals elsewhere in the DOM. */}
      {open && (
        <AvatarCropModal
          file={selectedImage}
          isOpen={open}
          onClose={handleClose}
          onSave={handleSaveImage}
        />
      )}
    </div>
  );
};

export default AvatarUpload;
