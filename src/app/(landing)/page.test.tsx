import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from './page';

vi.mock('@/components/landing/HomePageSliderClient', () => ({
  HomePageSliderClient: () => <div data-testid="home-page-slider" />,
}));

describe('LandingPage', () => {
  it('renders the hero section with relative, isolate, and overflow-hidden positioning for the fill background image', () => {
    render(<LandingPage />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /交流讓.*改變發生/,
    });
    const heroSection = heading.closest('section');

    expect(heroSection).not.toBeNull();
    expect(heroSection).toHaveClass('relative', 'isolate', 'overflow-hidden');

    const heroImage = screen.getByAltText(
      'X-Talent 平台主視覺：專業工作者交流情境'
    );
    expect(heroImage).toBeInTheDocument();
    expect(heroImage).toHaveClass('-z-10');
  });
});
