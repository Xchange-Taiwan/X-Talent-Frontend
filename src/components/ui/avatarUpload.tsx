import AddAPhotoRoundedIcon from '@mui/icons-material/AddAPhotoRounded';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import Image from 'next/image';
import { useState } from 'react';
import { Control, FieldValues, Path, useController } from 'react-hook-form';

import AvatarCropModal from './avatarCropModal';

interface AvatarUploadProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  maxSize?: number;
  avatarUrl?: string;
}

const AvatarUpload = <T extends FieldValues>({
  control,
  name,
  maxSize = 2 * 1024 * 1024,
  avatarUrl,
}: AvatarUploadProps<T>) => {
  const { field } = useController({ control, name });

  const imagePreviewUrl = field.value
    ? URL.createObjectURL(field.value)
    : avatarUrl;

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);

  const handleUploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= maxSize) {
      setSelectedImage(file);
      setOpen(true);
    } else if (file) {
      alert(`上傳的檔案大小不能超過 ${maxSize / (1024 * 1024)}MB`);
    }
  };

  const handleSaveImage = (croppedImageBlob: Blob) => {
    if (croppedImageBlob) {
      const croppedFile = new File([croppedImageBlob], 'croppedAvatar.png', {
        type: 'image/png',
      });
      field.onChange(croppedFile);
      setSelectedImage(croppedFile);
    }
  };

  return (
    <div className="mb-10 flex">
      <div
        className="group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[#B7CBCB] bg-[#F4FCFC]"
        style={{ width: 100, height: 100 }}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUploadAvatar}
        />

        {/* Hover show upload icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#6f6f6f] opacity-0 transition-opacity duration-200 group-hover:opacity-75">
          <AddAPhotoRoundedIcon sx={{ fontSize: 50, color: '#B7CBCB' }} />
        </div>

        {/* Modal for cropping image */}
        <AvatarCropModal
          file={selectedImage}
          isOpen={open}
          onClose={handleClose}
          onSave={handleSaveImage}
        />

        {imagePreviewUrl ? (
          <Image
            src={imagePreviewUrl}
            alt="Avatar Preview"
            width={50}
            height={50}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          // Show default avatar if no image is selected
          <ImageIcon sx={{ fontSize: 50, color: '#B7CBCB' }} />
        )}
      </div>
    </div>
  );
};

export default AvatarUpload;
