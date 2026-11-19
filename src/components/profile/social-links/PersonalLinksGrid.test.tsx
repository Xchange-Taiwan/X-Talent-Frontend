import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PersonalLinksGrid } from './PersonalLinksGrid';
import { resolveDisplaySocialLinks } from './platformLabelMap';

describe('PersonalLinksGrid', () => {
  it('renders all 7 platforms with short X label, external arrow on filled links, and aria-disabled on unfilled links', () => {
    const links = resolveDisplaySocialLinks([
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/zahra' },
      { platform: 'twitter', url: 'https://x.com/zahra' },
    ]);

    render(<PersonalLinksGrid links={links} userId="42" />);

    const nav = screen.getByRole('navigation', { name: '個人連結' });
    expect(nav).toBeInTheDocument();

    const linkedinLink = screen.getByRole('link', { name: 'LinkedIn' });
    expect(linkedinLink).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/zahra'
    );

    const xLink = screen.getByRole('link', { name: 'X (formerly Twitter)' });
    expect(xLink).toHaveAttribute('href', 'https://x.com/zahra');
    expect(xLink).toHaveTextContent('X');

    const githubDisabled = screen
      .getByText('GitHub')
      .closest('[aria-disabled]');
    expect(githubDisabled).toHaveAttribute('aria-disabled', 'true');
  });
});
