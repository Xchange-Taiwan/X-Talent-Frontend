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

  // Responsive editor size: constrained by both viewport width and height.
  // Width overhead: p-6 padding (24×2) + safety = 56px.
  // Height overhead: p-6 padding (48px) + slider (~48px) + button (~56px) + browser chrome = 200px.
  // Capped at 512px on larger screens, minimum 160px.
  const [editorSize, setEditorSize] = useState(512);
  useEffect(() => {
    const calculate = (): void => {
      // Overhead breakdown:
      //   p-4 backdrop (16×2) + p-6 card (24×2) + AvatarEditor border (50×2) + safety = 196px
      const byWidth = Math.max(160, window.innerWidth - 196);
      const byHeight = Math.max(160, window.innerHeight - 200);
      setEditorSize(Math.min(512, byWidth, byHeight));
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  const handleSaveImage = () => {
    if (!editorRef.current) return;
    const editorCanvas = editorRef.current.getImageScaledToCanvas();
    const out = document.createElement('canvas');
    out.width = 1024;
    out.height = 1024;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(editorCanvas, 0, 0, 1024, 1024);
    const maxBytes = 2 * 1024 * 1024;

    out.toBlob((pngBlob) => {
      if (!pngBlob) return;
      if (pngBlob.size <= maxBytes) {
        onSave(pngBlob);
        onClose();
      } else {
        out.toBlob(
          (jpegBlob) => {
            if (jpegBlob) {
              onSave(jpegBlob);
              onClose();
            }
          },
          'image/jpeg',
          0.85
        );
      }
    });
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-full overflow-y-auto rounded-lg bg-[#F4FCFC] p-6 shadow-lg">
          {file && (
            <AvatarEditor
              ref={editorRef}
              image={file}
              width={editorSize}
              height={editorSize}
              border={50}
              borderRadius={300}
              scale={zoomScale}
              style={{ touchAction: 'none' }}
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
          <div className="mt-4 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl px-12"
            >
              取消
            </Button>
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
