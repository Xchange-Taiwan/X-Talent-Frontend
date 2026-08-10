import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HamburgerMenu } from './HamburgerMenu';

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: '開啟導航選單' }));
}

describe('HamburgerMenu', () => {
  it('renders guest-only navigation links and login/register actions when opened', () => {
    render(<HamburgerMenu />);
    openMenu();

    expect(screen.getByRole('link', { name: '尋找導師' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '成為導師' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '關於 X-Talent' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '提供回饋（另開新分頁）' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '註冊' })).toBeInTheDocument();
  });

  it('closes the sheet when a navigation link is clicked', () => {
    render(<HamburgerMenu />);
    openMenu();

    const findMentorLink = screen.getByRole('link', { name: '尋找導師' });
    fireEvent.click(findMentorLink);

    // The sheet closes, so the navigation links are removed from the DOM
    expect(
      screen.queryByRole('link', { name: '尋找導師' })
    ).not.toBeInTheDocument();
  });
});
