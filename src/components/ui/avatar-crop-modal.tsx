import { Modal, Slider } from '@mui/material';
import React, { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';

import { Button } from '@/components/ui/button';

interface AvatarCropModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: Blob) => void;
}

const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  file,
  isOpen,
  onClose,
  onSave,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const editorRef = useRef<AvatarEditor | null>(null);

  const handleSaveImage = () => {
    if (editorRef.current) {
      const imageUrl = editorRef.current.getImageScaledToCanvas().toDataURL();
      fetch(imageUrl)
        .then((response) => response.blob())
        .then((blob) => {
          onSave(blob);
          onClose();
        })
        .catch((error) => {
          console.error('Error saving image:', error);
        });
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div
        className="fixed inset-0 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-lg bg-[#F4FCFC] p-6 shadow-lg">
          {file && (
            <AvatarEditor
              ref={editorRef}
              image={file}
              width={512}
              height={512}
              border={50}
              borderRadius={300}
              scale={zoomScale}
            />
          )}
          <Slider
            value={zoomScale}
            min={1}
            max={3}
            step={0.1}
            onChange={(_, newScale) => setZoomScale(newScale as number)}
            className="mt-4"
          />
          <div className="mt-4 flex justify-center">
            <Button onClick={handleSaveImage} className="rounded-xl px-12">
              儲存
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AvatarCropModal;
