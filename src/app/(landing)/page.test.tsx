import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/landing/HomePageSliderClient', () => ({
  HomePageSliderClient: () => <div data-testid="home-page-slider" />,
}));

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import { authenticatedIdentity, GUEST_IDENTITY } from '@/test/mocks/identity';

import LandingPage from './page';

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);
  });

  it('renders the responsive HomePageHero section without fixed-height or object-center cropping (#892)', () => {
    render(<LandingPage />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /交流讓.*改變發生/,
    });
    const heroSection = heading.closest('section');

    expect(heroSection).not.toBeNull();
    expect(heroSection).toHaveAttribute('data-testid', 'homepage-hero');
    expect(heroSection).toHaveClass(
      'relative',
      'isolate',
      'overflow-hidden',
      'min-h-[clamp(360px,calc(100svh-70px),520px)]',
      'lg:min-h-[clamp(480px,calc(100svh-70px),600px)]',
      'lg:py-16'
    );
    expect(heading).toHaveClass('text-3xl', 'sm:text-4xl', 'md:text-5xl');

    const subtitle = screen.getByText(
      'Find your Mentor/Mentee to build up connections, break up limits.'
    );
    expect(subtitle).toHaveClass(
      'max-w-[320px]',
      'md:max-w-[420px]',
      'lg:max-w-[520px]',
      'lg:text-2xl'
    );

    const heroImage = screen.getByAltText(
      'X-Talent 平台主視覺：專業工作者交流情境'
    );
    expect(heroImage).toBeInTheDocument();
    expect(heroImage).toHaveClass(
      'h-auto',
      'w-[clamp(760px,calc(100vw-264px),1320px)]',
      'max-w-none'
    );
  });

  it.each([
    ['visitor', GUEST_IDENTITY, '/auth/signup', '/auth/signup'],
    [
      'mentee',
      authenticatedIdentity('mentee-55', { isMentor: false }),
      '/mentor-pool',
      '/profile/mentee-55/edit?mentor-onboarding=true',
    ],
    [
      'mentor',
      authenticatedIdentity('mentor-88', { isMentor: true }),
      '/mentor-pool',
      '/profile/mentor-88?open-schedule=true',
    ],
  ] as const)(
    'renders CTA sections and destinations for %s (#709)',
    (_role, identity, primaryHref, roleHref) => {
      mockUseResolvedIdentity.mockReturnValue(identity);
      render(<LandingPage />);

      expect(
        screen.getByText('成為 Mentor 或 Mentee，展開你的下一段交流。')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: /你的下一步，.*從一次交流開始。/,
        })
      ).toBeInTheDocument();
      expect(screen.getByTestId('homepage-cta-hero')).toHaveAttribute(
        'href',
        primaryHref
      );
      expect(screen.getByTestId('homepage-cta-role')).toHaveAttribute(
        'href',
        roleHref
      );
      expect(screen.getByTestId('homepage-cta-closing')).toHaveAttribute(
        'href',
        primaryHref
      );
    }
  );
});
