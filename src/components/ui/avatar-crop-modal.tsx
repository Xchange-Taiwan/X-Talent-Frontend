import { Modal, Slider } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
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

  // Responsive editor size: fit within the viewport minus modal padding (p-6 = 24px×2)
  // and a small safety buffer. Capped at 512px on larger screens.
  const [editorSize, setEditorSize] = useState(512);
  useEffect(() => {
    const calculate = (): void => {
      setEditorSize(Math.min(512, Math.max(200, window.innerWidth - 56)));
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  const handleSaveImage = async () => {
    if (editorRef.current) {
      try {
        const imageUrl = editorRef.current.getImageScaledToCanvas().toDataURL();
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        onSave(blob);
        onClose();
      } catch (error) {
        console.error('Error saving image:', error);
      }
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
              width={editorSize}
              height={editorSize}
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
