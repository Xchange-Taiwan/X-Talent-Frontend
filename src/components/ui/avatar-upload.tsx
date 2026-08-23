import { Camera, ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Control, FieldValues, Path, useController } from 'react-hook-form';

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
}

const AvatarUpload = <T extends FieldValues>({
  control,
  name,
  avatarUrl,
  onFileChange,
}: AvatarUploadProps<T>) => {
  const { field, fieldState } = useController({ control, name });
  const errorMessage = fieldState.error?.message;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const imagePreviewUrl = field.value
    ? URL.createObjectURL(field.value)
    : avatarUrl;

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
      const croppedFile = new File([croppedImageBlob], 'croppedAvatar.png', {
        type: 'image/png',
      });
      field.onChange(croppedFile);
      setSelectedImage(croppedFile);
      onFileChange?.(croppedFile);
    }
  };

  return (
    <div className="mb-10 flex flex-col items-center lg:items-start">
      <div
        className={`group bg-avatar-background relative flex size-36 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 lg:h-[150px] lg:w-[150px] ${
          errorMessage ? 'border-status-error-default' : 'border-avatar-border'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadAvatar}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Hover show upload icon */}
        <div className="bg-avatar-overlay absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-75">
          <Camera size={50} className="text-avatar-border" />
        </div>

        {imagePreviewUrl ? (
          <Image
            src={imagePreviewUrl}
            alt="Avatar Preview"
            width={150}
            height={150}
            sizes="150px"
            className="size-full rounded-full object-cover"
            priority
          />
        ) : (
          // Show default avatar if no image is selected
          <ImageIcon size={50} className="text-avatar-border" />
        )}
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
