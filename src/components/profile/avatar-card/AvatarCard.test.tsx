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

describe('AvatarCard (#898)', () => {
  it('renders sanitized multi-platform personalLinks as external <a target="_blank" rel="noopener noreferrer"> anchors', () => {
    render(
      <AvatarCard
        name="Hana Lin"
        jobTitle="Staff Engineer"
        companyName="XChange"
        personalLinks={[
          { platform: 'linkedin', url: 'https://www.linkedin.com/in/hana-lin' },
          { platform: 'twitter', url: 'https://x.com/hanalin' },
          { platform: 'website', url: 'https://hanalin.dev' },
        ]}
      />
    );

    const linkedinAnchor = screen.getByRole('link', { name: 'LinkedIn' });
    expect(linkedinAnchor).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/hana-lin'
    );
    expect(linkedinAnchor).toHaveAttribute('target', '_blank');
    expect(linkedinAnchor).toHaveAttribute('rel', 'noopener noreferrer');

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
});
