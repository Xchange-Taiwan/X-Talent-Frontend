import { Modal, Slider } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';

import { Button } from '@/components/ui/button';

interface AvatarCropModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: Blob) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;

// Mentor-pool desktop card avatar area is 413×292 (see AvatarWithBadge.tsx).
// Preview keeps that aspect so users see exactly which slice of the square
// crop will end up on the card before they save.
const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 292) / 413);

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
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(
    null
  );

  // Mirrors object-cover: scales the square crop to cover the wider preview
  // box, then centers it horizontally and vertically — same math the browser
  // applies to the mentor-pool card.
  const renderPreview = useCallback(() => {
    const editor = editorRef.current;
    const preview = previewCanvasRef.current;
    if (!editor || !preview) return;

    const cropped = editor.getImageScaledToCanvas();
    const ctx = preview.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, preview.width, preview.height);

    const sw = cropped.width;
    const sh = cropped.height;
    const dw = preview.width;
    const dh = preview.height;
    const scale = Math.max(dw / sw, dh / sh);
    const renderW = sw * scale;
    const renderH = sh * scale;
    const offsetX = (dw - renderW) / 2;
    const offsetY = (dh - renderH) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cropped, offsetX, offsetY, renderW, renderH);
  }, []);

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
  // Plus the desktop-card preview block: label (~18px) + gap (~12px) + canvas.
  // Capped at 512px on larger screens, minimum 160px.
  const [editorSize, setEditorSize] = useState(512);
  useEffect(() => {
    const calculate = (): void => {
      // Overhead breakdown:
      //   p-4 backdrop (16×2) + p-6 card (24×2) + AvatarEditor border (50×2) + safety = 196px
      const byWidth = Math.max(160, window.innerWidth - 196);
      const byHeight = Math.max(
        160,
        window.innerHeight - 200 - PREVIEW_HEIGHT - 30
      );
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
    <Modal open={isOpen} onClose={onClose}>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-full overflow-y-auto rounded-lg bg-[#F4FCFC] p-6 shadow-lg">
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
                onImageReady={renderPreview}
                onImageChange={renderPreview}
              />
            </div>
          )}
          <Slider
            value={zoomScale}
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.1}
            onChange={(_, newScale) => setZoomScale(newScale as number)}
            className="mt-4"
          />
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <span className="text-xs text-[#9DA8B9]">桌機卡片顯示預覽</span>
            <canvas
              ref={previewCanvasRef}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              className="bg-white rounded-lg border border-[#E6E8EA]"
            />
          </div>
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
