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

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const EDITOR_BORDER = 50;

// Mentor-pool desktop card avatar area is 413×292 (see AvatarWithBadge.tsx).
// We still save a full square (so circular/square avatar consumers have
// content), but visually highlight the desktop card's visible band inside
// the editor — anything outside that band only shows in the non-card
// displays.
const CARD_ASPECT = 292 / 413;

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
  // Capped at 512px on larger screens, minimum 160px.
  const [editorSize, setEditorSize] = useState(512);
  useEffect(() => {
    const calculate = (): void => {
      // Overhead breakdown:
      //   p-4 backdrop (16×2) + p-6 card (24×2) + AvatarEditor border (50×2) + safety = 196px
      const byWidth = Math.max(160, window.innerWidth - 196);
      // p-6 padding (48px) + slider (~48px) + button (~56px) + browser chrome = 200px
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
              style={{ position: 'relative', touchAction: 'none' }}
            >
              <AvatarEditor
                ref={editorRef}
                image={file}
                width={editorSize}
                height={editorSize}
                border={EDITOR_BORDER}
                scale={zoomScale}
                style={{ touchAction: 'none' }}
              />
              {/* Desktop-card visible band overlay. The dim strips show the
                  area that gets cropped away on the desktop mentor card
                  (other avatar surfaces still consume the full square). */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: EDITOR_BORDER,
                  left: EDITOR_BORDER,
                  width: editorSize,
                  height: editorSize,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: (editorSize * (1 - CARD_ASPECT)) / 2,
                    background: 'rgba(0, 0, 0, 0.45)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: (editorSize * (1 - CARD_ASPECT)) / 2,
                    background: 'rgba(0, 0, 0, 0.45)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: (editorSize * (1 - CARD_ASPECT)) / 2,
                    bottom: (editorSize * (1 - CARD_ASPECT)) / 2,
                    left: 0,
                    right: 0,
                    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.9)',
                  }}
                />
              </div>
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
