import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DisabledAwareLink } from './DisabledAwareLink';

describe('DisabledAwareLink', () => {
  it('renders a normal link and forwards ref when disabled is false', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <DisabledAwareLink ref={ref} href="/mentor-pool" aria-current="page">
        尋找導師
      </DisabledAwareLink>
    );

    const link = screen.getByRole('link', { name: '尋找導師' });
    expect(ref.current).toBe(link);
    expect(link).toHaveAttribute('href', '/mentor-pool');
    expect(link).toHaveAttribute('aria-disabled', 'false');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('neutralizes href, tabIndex, and click events when disabled is true', () => {
    const onClick = vi.fn();
    render(
      <DisabledAwareLink href="/profile/user-1" disabled onClick={onClick}>
        個人頁面
      </DisabledAwareLink>
    );

    const link = screen.getByRole('link', { name: '個人頁面' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');

    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
