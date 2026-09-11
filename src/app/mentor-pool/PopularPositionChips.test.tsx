import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockRouter } from '@/test/mocks/navigation';

import PopularPositionChips from './PopularPositionChips';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

describe('PopularPositionChips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders popular position chips with correct hover and focus classes', () => {
    render(<PopularPositionChips />);

    // Get all popular position buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((button) => {
      // Assert hover class is updated to brand-50 for high contrast
      expect(button).toHaveClass('hover:bg-brand-50');

      // Assert text color is text-text-primary to ensure sufficient contrast
      expect(button).toHaveClass('text-text-primary');

      // Assert focus-visible styles are unaffected and properly defined
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toHaveClass('focus-visible:outline-none');
    });
  });

  it('handles click events and dispatches router push with updated search parameters', () => {
    render(<PopularPositionChips />);

    // Get the first popular position button
    const firstButton = screen.getAllByRole('button')[0];
    const positionText = firstButton.textContent;
    expect(positionText).toBeTruthy();

    // Trigger click on the first button
    fireEvent.click(firstButton);

    // Verify router push is dispatched with correct URI containing position query parameter
    expect(mockRouter.push).toHaveBeenCalled();
    const pushArg = mockRouter.push.mock.calls[0][0];
    expect(pushArg).toContain(encodeURIComponent(positionText!));
  });
});
