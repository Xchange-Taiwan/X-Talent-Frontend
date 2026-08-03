import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

import MaintenancePage from './page';

describe('MaintenancePage', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location cleanly using Object.defineProperty
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: {
        ...originalLocation,
        href: '',
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it('renders the maintenance page correctly with static content', () => {
    render(<MaintenancePage />);

    expect(screen.getByText('系統維護中')).toBeInTheDocument();
    expect(screen.getByText(/為了提供更優質、穩定的服務/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '重新整理試試' })
    ).toBeInTheDocument();
  });

  it('sets loading state, disables button, and redirects to homepage when reload is clicked', () => {
    render(<MaintenancePage />);

    const button = screen.getByRole('button', { name: '重新整理試試' });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    // After click, the button should be disabled and have loading text
    expect(button).toBeDisabled();
    expect(screen.getByText('正在檢查...')).toBeInTheDocument();
    expect(window.location.href).toBe('/');
  });
});
