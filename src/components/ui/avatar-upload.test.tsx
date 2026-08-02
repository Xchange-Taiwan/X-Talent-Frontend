import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import AvatarUpload from './avatar-upload';

// Mock dynamic import of AvatarCropModal to prevent rendering issues in tests
vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="mock-crop-modal">Mock Crop Modal</div>,
}));

// Polyfill URL.createObjectURL for test environment if not present
if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'mock-image-url');
}

interface TestFormValues {
  avatar: File | null;
}

const TestFormWrapper: React.FC<{
  avatarUrl?: string;
  onFileChange?: (file: File) => void;
}> = ({ avatarUrl, onFileChange }) => {
  const { control } = useForm<TestFormValues>({
    defaultValues: {
      avatar: null,
    },
  });

  return (
    <AvatarUpload
      control={control}
      name="avatar"
      avatarUrl={avatarUrl}
      onFileChange={onFileChange}
    />
  );
};

describe('AvatarUpload', () => {
  it('renders the avatar upload uploader with correct accessibility attributes', () => {
    render(<TestFormWrapper />);

    const uploadButton = screen.getByRole('button');
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toHaveAttribute('tabindex', '0');
  });

  it('triggers input click when mouse clicked', () => {
    const { container } = render(<TestFormWrapper />);

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const uploadButton = screen.getByRole('button');
    fireEvent.click(uploadButton);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('triggers input click when Space key is pressed', () => {
    const { container } = render(<TestFormWrapper />);

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const uploadButton = screen.getByRole('button');

    // Test Space key down
    fireEvent.keyDown(uploadButton, { key: ' ', code: 'Space' });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('triggers input click when Enter key is pressed', () => {
    const { container } = render(<TestFormWrapper />);

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const uploadButton = screen.getByRole('button');

    // Test Enter key down
    fireEvent.keyDown(uploadButton, { key: 'Enter', code: 'Enter' });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('does not trigger input click when other keys are pressed', () => {
    const { container } = render(<TestFormWrapper />);

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const uploadButton = screen.getByRole('button');

    // Test other keys
    fireEvent.keyDown(uploadButton, { key: 'Escape', code: 'Escape' });
    fireEvent.keyDown(uploadButton, { key: 'Tab', code: 'Tab' });

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
