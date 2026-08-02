import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import AvatarCropModal from './avatar-crop-modal';

// Mock ResizeObserver for Radix UI components under JSDOM
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

// Mock HTMLCanvasElement prototype methods to bypass JSDOM limitations
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
});
HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((callback) => {
  callback(new Blob());
});

interface MockAvatarEditorProps {
  image: File | string;
  width: number;
  height: number;
  border?: number;
  borderRadius?: number;
  scale?: number;
  style?: React.CSSProperties;
}

interface MockAvatarEditorHandle {
  getImage: () => HTMLCanvasElement;
}

// Mock react-avatar-editor to avoid canvas drawing issues in jsdom
vi.mock('react-avatar-editor', () => {
  const MockAvatarEditor = React.forwardRef<
    MockAvatarEditorHandle,
    MockAvatarEditorProps
  >((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      getImage: () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        return canvas;
      },
    }));
    return <div data-testid="avatar-editor" data-scale={_props.scale} />;
  });
  MockAvatarEditor.displayName = 'AvatarEditor';

  return {
    default: MockAvatarEditor,
  };
});

describe('AvatarCropModal', () => {
  const mockFile = new File([''], 'test-avatar.png', { type: 'image/png' });

  it('renders modal content when open', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <AvatarCropModal
        file={mockFile}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    // Verify dialog/modal content exists
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText('儲存')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-editor')).toBeInTheDocument();
  });

  it('calls onClose when close/cancel button is clicked', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <AvatarCropModal
        file={mockFile}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    const cancelButton = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave and onClose when save button is clicked', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <AvatarCropModal
        file={mockFile}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    const saveButton = screen.getByRole('button', { name: '儲存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('updates scale when slider is interacted with', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <AvatarCropModal
        file={mockFile}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByTestId('avatar-editor')).toHaveAttribute(
      'data-scale',
      '1'
    );

    // Simulate pressing ArrowRight to increase the scale
    fireEvent.keyDown(slider, { key: 'ArrowRight', code: 'ArrowRight' });

    // Expect the value to have increased (by step 0.1)
    expect(slider).toHaveAttribute('aria-valuenow', '1.1');
    expect(screen.getByTestId('avatar-editor')).toHaveAttribute(
      'data-scale',
      '1.1'
    );
  });

  it('calls onClose when Escape key is pressed (onOpenChange default closing)', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <AvatarCropModal
        file={mockFile}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    // Simulate pressing Escape key on the dialog container
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('handles pinch-to-zoom touch events on mobile devices', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <AvatarCropModal
        file={mockFile}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    const touchContainer = screen.getByTestId('avatar-editor').parentElement;
    expect(touchContainer).toBeInTheDocument();
    expect(screen.getByTestId('avatar-editor')).toHaveAttribute(
      'data-scale',
      '1'
    );

    // Mock two touch points for pinch start (distance = 10px apart)
    const touchStartPoints = [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 10 },
    ];

    // Mock two touch points for pinch move (distance = 20px apart, meaning ratio = 2)
    const touchMovePoints = [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 20 },
    ];

    // Trigger touchStart with 2 touches
    fireEvent.touchStart(touchContainer!, {
      touches: touchStartPoints,
      targetTouches: touchStartPoints,
      changedTouches: touchStartPoints,
    });

    // Trigger touchMove with 2 touches
    fireEvent.touchMove(touchContainer!, {
      touches: touchMovePoints,
      targetTouches: touchMovePoints,
      changedTouches: touchMovePoints,
    });

    // Trigger touchEnd to clear the touch references
    fireEvent.touchEnd(touchContainer!, {
      touches: [],
      targetTouches: [],
      changedTouches: [],
    });

    // Expect the scale to have doubled (ratio 2 * initial scale 1 = 2)
    expect(screen.getByTestId('avatar-editor')).toHaveAttribute(
      'data-scale',
      '2'
    );
  });
});
