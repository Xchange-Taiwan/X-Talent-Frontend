import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

import { AvatarCard } from './AvatarCard';

describe('AvatarCard (#898, #862)', () => {
  it('renders sanitized multi-platform personalLinks including GitHub in canonical order as external <a target="_blank" rel="noopener noreferrer"> anchors', () => {
    render(
      <AvatarCard
        name="Hana Lin"
        jobTitle="Staff Engineer"
        companyName="XChange"
        personalLinks={[
          { platform: 'website', url: 'https://hanalin.dev' },
          { platform: 'github', url: 'github.com/hana-lin' },
          { platform: 'facebook', url: 'https://www.facebook.com/hana-lin' },
          { platform: 'linkedin', url: 'https://www.linkedin.com/in/hana-lin' },
          { platform: 'twitter', url: 'https://x.com/hanalin' },
        ]}
      />
    );

    const allLinks = screen.getAllByRole('link');
    expect(allLinks.map((a) => a.getAttribute('aria-label'))).toEqual([
      'LinkedIn',
      'Facebook',
      'X (formerly Twitter)',
      'GitHub',
      '個人網站',
    ]);

    const linkedinAnchor = screen.getByRole('link', { name: 'LinkedIn' });
    expect(linkedinAnchor).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/hana-lin'
    );
    expect(linkedinAnchor).toHaveAttribute('target', '_blank');
    expect(linkedinAnchor).toHaveAttribute('rel', 'noopener noreferrer');

    const githubAnchor = screen.getByRole('link', { name: 'GitHub' });
    expect(githubAnchor).toHaveAttribute('href', 'https://github.com/hana-lin');
    expect(githubAnchor).toHaveAttribute('target', '_blank');
    expect(githubAnchor).toHaveAttribute('rel', 'noopener noreferrer');

    const twitterAnchor = screen.getByRole('link', {
      name: 'X (formerly Twitter)',
    });
    expect(twitterAnchor).toHaveAttribute('href', 'https://x.com/hanalin');
    expect(twitterAnchor).toHaveAttribute('target', '_blank');
    expect(twitterAnchor).toHaveAttribute('rel', 'noopener noreferrer');

    const websiteAnchor = screen.getByRole('link', { name: '個人網站' });
    expect(websiteAnchor).toHaveAttribute('href', 'https://hanalin.dev');
  });

  it('filters out unsafe schemes, lookalike domains, and unknown platforms', () => {
    render(
      <AvatarCard
        name="Hana Lin"
        personalLinks={[
          { platform: 'website', url: 'javascript:alert(1)' },
          { platform: 'linkedin', url: 'http://linkedin.com/in/hana-lin' },
          { platform: 'linkedin', url: 'https://evil-linkedin.com/in/hana' },
          { platform: 'github', url: 'https://evil-github.com/hana' },
          { platform: 'unknown_platform', url: 'https://example.com' },
          { platform: 'youtube', url: 'https://youtu.be/abc123' },
        ]}
      />
    );

    const anchors = screen.getAllByRole('link');
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toHaveAccessibleName('YouTube');
    expect(anchors[0]).toHaveAttribute('href', 'https://youtu.be/abc123');
  });

  it('wraps avatar alt, real name heading, company/jobTitle, and social link aria-labels inside data-clarity-mask="true" (#950)', () => {
    render(
      <AvatarCard
        name="張三豐 Real Mentor"
        jobTitle="Principal Architect"
        companyName="Acme"
        personalLinks={[
          { platform: 'linkedin', url: 'https://www.linkedin.com/in/zhang' },
        ]}
      />
    );

    const heading = screen.getByRole('heading', { name: '張三豐 Real Mentor' });
    const img = screen.getByAltText('Avatar of 張三豐 Real Mentor');
    const link = screen.getByRole('link', { name: 'LinkedIn' });
    expect(heading.closest('[data-clarity-mask="true"]')).not.toBeNull();
    expect(img.closest('[data-clarity-mask="true"]')).not.toBeNull();
    expect(link.closest('[data-clarity-mask="true"]')).not.toBeNull();
  });
});
