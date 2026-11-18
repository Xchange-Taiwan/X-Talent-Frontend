import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const MockAvatarCropModal = ({
      isOpen,
      onSave,
      onClose,
    }: {
      isOpen: boolean;
      onSave: (blob: Blob) => void;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div data-testid="mock-crop-modal">
          <button
            type="button"
            onClick={() => {
              onSave(new Blob(['cropped-bytes'], { type: 'image/png' }));
              onClose();
            }}
          >
            完成裁切
          </button>
        </div>
      ) : null;
    return MockAvatarCropModal;
  },
}));

import { MenteeAvatarDialog } from './MenteeAvatarDialog';

describe('MenteeAvatarDialog (#828)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview-url');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  it('renders dialog title, preview trigger, 6 preset avatar buttons, and fallback default avatar when none selected', () => {
    render(
      <MenteeAvatarDialog
        open={true}
        onOpenChange={vi.fn()}
        currentAvatarUrl=""
        userName="林小英"
        onSavePreset={vi.fn()}
        onSaveCustomFile={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { name: '編輯頭像' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '編輯個人頭像' })
    ).toBeInTheDocument();

    for (let i = 1; i <= 6; i += 1) {
      const btn = screen.getByRole('button', { name: `預設頭像 ${i}` });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('highlights selected preset with aria-pressed="true" and calls onSavePreset with /avatars/default_3.webp on confirm', () => {
    const onSavePreset = vi.fn();
    const onSaveCustomFile = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MenteeAvatarDialog
        open={true}
        onOpenChange={onOpenChange}
        currentAvatarUrl=""
        userName="林小英"
        onSavePreset={onSavePreset}
        onSaveCustomFile={onSaveCustomFile}
      />
    );

    const preset3 = screen.getByRole('button', { name: '預設頭像 3' });
    fireEvent.click(preset3);
    expect(preset3).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '儲存頭像' }));

    expect(onSavePreset).toHaveBeenCalledWith('/avatars/default_3.webp');
    expect(onSaveCustomFile).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports uploading and cropping a custom photo, clearing preset selection, and calling onSaveCustomFile', async () => {
    const onSavePreset = vi.fn();
    const onSaveCustomFile = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MenteeAvatarDialog
        open={true}
        onOpenChange={onOpenChange}
        currentAvatarUrl="/avatars/default_2.webp"
        userName="林小英"
        onSavePreset={onSavePreset}
        onSaveCustomFile={onSaveCustomFile}
      />
    );

    const preset2 = screen.getByRole('button', { name: '預設頭像 2' });
    expect(preset2).toHaveAttribute('aria-pressed', 'true');

    const fileInput = screen.getByLabelText('選擇個人照片');
    const rawFile = new File(['raw-image'], 'photo.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [rawFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('mock-crop-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '完成裁切' }));

    expect(screen.getByRole('button', { name: '預設頭像 2' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: '儲存頭像' }));

    expect(onSaveCustomFile).toHaveBeenCalledTimes(1);
    expect(onSaveCustomFile.mock.calls[0][0]).toBeInstanceOf(File);
    expect(onSavePreset).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('discards draft changes when clicking 取消', () => {
    const onSavePreset = vi.fn();
    const onSaveCustomFile = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <MenteeAvatarDialog
        open={true}
        onOpenChange={onOpenChange}
        currentAvatarUrl=""
        userName="林小英"
        onSavePreset={onSavePreset}
        onSaveCustomFile={onSaveCustomFile}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '預設頭像 5' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onSavePreset).not.toHaveBeenCalled();
    expect(onSaveCustomFile).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
