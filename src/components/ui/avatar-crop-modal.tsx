import * as SliderPrimitive from '@radix-ui/react-slider';
import React, { useEffect, useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface AvatarCropModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: Blob) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;

const clampScale = (value: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

const getTouchDistance = (touches: React.TouchList): number => {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  file,
  isOpen,
  onClose,
  onSave,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const editorRef = useRef<AvatarEditor | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(
    null
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length === 2) {
      pinchStartRef.current = {
        distance: getTouchDistance(e.touches),
        scale: zoomScale,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length !== 2 || !pinchStartRef.current) return;
    e.preventDefault();
    const ratio = getTouchDistance(e.touches) / pinchStartRef.current.distance;
    setZoomScale(clampScale(pinchStartRef.current.scale * ratio));
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length < 2) {
      pinchStartRef.current = null;
    }
  };

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
    // getImage() = original-resolution crop; getImageScaledToCanvas() = display size (≤512px) → upscale → blurry
    const sourceCanvas = editorRef.current.getImage();
    const out = document.createElement('canvas');
    out.width = 1024;
    out.height = 1024;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, 1024, 1024);
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-full w-auto max-w-none overflow-y-auto bg-avatar-background sm:rounded-lg [&>button]:hidden">
        <DialogTitle className="sr-only">裁切頭像</DialogTitle>
        {file && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{ touchAction: 'none' }}
          >
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
          </div>
        )}
        <SliderPrimitive.Root
          className="relative mt-4 flex h-5 w-full touch-none select-none items-center"
          value={[zoomScale]}
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.1}
          onValueChange={(value) => setZoomScale(value[0])}
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-background-border">
            <SliderPrimitive.Range className="absolute h-full bg-brand-500" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block size-5 cursor-pointer rounded-full border-2 border-brand-500 bg-background-white ring-offset-background-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>
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
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropModal;
