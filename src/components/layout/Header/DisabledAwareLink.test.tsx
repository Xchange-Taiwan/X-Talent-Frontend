import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DisabledAwareLink } from './DisabledAwareLink';

describe('DisabledAwareLink', () => {
  it('renders a normal, focusable link when not disabled', () => {
    render(
      <DisabledAwareLink href="/profile/user-123">Profile</DisabledAwareLink>
    );

    const link = screen.getByRole('link', { name: 'Profile' });
    expect(link).toHaveAttribute('href', '/profile/user-123');
    expect(link).toHaveAttribute('aria-disabled', 'false');
    expect(link).not.toHaveAttribute('tabindex', '-1');
  });

  it('renders inert — href, tabIndex, and click all neutralized — when disabled', () => {
    const onClick = vi.fn();
    render(
      <DisabledAwareLink href="/profile/user-123" disabled onClick={onClick}>
        Profile
      </DisabledAwareLink>
    );

    const link = screen.getByRole('link', { name: 'Profile' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');

    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
