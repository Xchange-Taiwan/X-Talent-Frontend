import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  // next/image requires width/height derived from a static-import object
  // shape that Vitest's asset transform doesn't produce; not relevant to
  // the focus-ring assertions under test here.
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

import { Footer } from './Footer';

describe('Footer', () => {
  it('gives every footer link a visible keyboard focus ring tuned for the dark background', () => {
    render(<Footer />);

    const privacyLink = screen.getByRole('link', { name: '隱私權政策' });
    const websiteLink = screen.getByRole('link', { name: 'XChange Website' });
    const facebookLink = screen.getByRole('link', {
      name: 'Facebook 粉絲專頁',
    });

    for (const link of [privacyLink, websiteLink, facebookLink]) {
      expect(link).toHaveClass('focus-visible:ring-2');
      expect(link).toHaveClass('focus-visible:ring-ring');
      expect(link).toHaveClass('focus-visible:outline-none');
      // Footer sits on a dark background, so the default white ring-offset
      // would otherwise render as a white+brand-color double ring - this
      // override keeps the offset gap blended into the dark background.
      expect(link).toHaveClass('focus-visible:ring-offset-dark');
    }
  });
});
