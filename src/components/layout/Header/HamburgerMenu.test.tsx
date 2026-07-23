import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HamburgerMenu } from './HamburgerMenu';

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: '開啟導航選單' }));
}

describe('HamburgerMenu', () => {
  it('disables "成為導師" while resolving a mentee user and does not close the sheet on click', () => {
    render(
      <HamburgerMenu
        isLoggedIn
        isMentor={false}
        userId={undefined}
        isResolvingUser
      />
    );
    openMenu();

    const link = screen.getByRole('link', { name: '成為導師' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(link);

    // A disabled link must not run the `close` handler — the sheet stays open.
    expect(screen.getByRole('link', { name: '成為導師' })).toBeInTheDocument();
  });

  it('disables "我的導師頁面" while resolving a mentor user, never falling back to "/"', () => {
    render(
      <HamburgerMenu isLoggedIn isMentor userId={undefined} isResolvingUser />
    );
    openMenu();

    const link = screen.getByRole('link', { name: '我的導師頁面' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('aria-disabled', 'true');
  });

  it('links to the real profile once userId has landed and isResolvingUser is false', () => {
    render(
      <HamburgerMenu
        isLoggedIn
        isMentor
        userId="user-123"
        isResolvingUser={false}
      />
    );
    openMenu();

    const link = screen.getByRole('link', { name: '我的導師頁面' });
    expect(link).toHaveAttribute('href', '/profile/user-123');
    expect(link).toHaveAttribute('aria-disabled', 'false');
  });

  it('closes the sheet when a normal (non-disabled) link is clicked', () => {
    render(
      <HamburgerMenu
        isLoggedIn
        isMentor
        userId="user-123"
        isResolvingUser={false}
      />
    );
    openMenu();

    fireEvent.click(screen.getByRole('link', { name: '我的導師頁面' }));

    expect(
      screen.queryByRole('link', { name: '我的導師頁面' })
    ).not.toBeInTheDocument();
  });
});
