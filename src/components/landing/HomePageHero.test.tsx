import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import { authenticatedIdentity, GUEST_IDENTITY } from '@/test/mocks/identity';

import { HomePageHero } from './HomePageHero';

describe('HomePageHero (#892)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);
  });

  it('uses flexible viewport-aware min-height and balanced vertical padding instead of fixed height and asymmetric top padding', () => {
    render(<HomePageHero />);

    const heroSection = screen.getByTestId('homepage-hero');
    expect(heroSection).toHaveClass(
      'relative',
      'isolate',
      'flex',
      'flex-col',
      'items-center',
      'justify-center',
      'overflow-hidden',
      'min-h-[clamp(360px,calc(100svh-70px),520px)]',
      'py-8',
      'sm:py-10',
      'lg:min-h-[clamp(480px,calc(100svh-70px),600px)]',
      'lg:py-16'
    );
    expect(heroSection).not.toHaveClass(
      'h-[532px]',
      'lg:h-[640px]',
      'lg:pt-[180px]',
      'bg-cover',
      'bg-center'
    );
  });

  it('promotes heading and subtitle typography at md:/lg: breakpoints so 1024px-1535px desktops do not shrink or jump at 2xl:', () => {
    render(<HomePageHero />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /交流讓.*改變發生/,
    });
    expect(heading).toHaveClass(
      'text-3xl',
      'sm:text-4xl',
      'md:text-5xl',
      'lg:mb-6'
    );
    expect(heading).not.toHaveClass('2xl:text-5xl');

    const subtitle = screen.getByText(
      'Find your Mentor/Mentee to build up connections, break up limits.'
    );
    expect(subtitle).toHaveClass(
      'max-w-[320px]',
      'text-lg',
      'md:max-w-[420px]',
      'md:text-xl',
      'lg:max-w-[520px]',
      'lg:text-2xl'
    );
    expect(subtitle).not.toHaveClass(
      'sm:max-w-[360px]',
      '2xl:text-2xl',
      '2xl:max-w-[630px]'
    );
  });

  it('renders edge-anchored left/right responsive artwork layers without object-cover center cropping', () => {
    render(<HomePageHero />);

    const primaryDesktopImage = screen.getByAltText(
      'X-Talent 平台主視覺：專業工作者交流情境'
    );
    expect(primaryDesktopImage).toHaveAttribute(
      'data-testid',
      'homepage-hero-desktop-left'
    );
    expect(primaryDesktopImage).toHaveClass(
      'h-auto',
      'w-[clamp(760px,calc(100vw-264px),1320px)]',
      'max-w-none'
    );
    expect(primaryDesktopImage).not.toHaveClass(
      'object-cover',
      'object-center'
    );

    const rightDesktopImage = screen.getByTestId('homepage-hero-desktop-right');
    expect(rightDesktopImage).toHaveAttribute('alt', '');
    expect(rightDesktopImage).toHaveClass(
      'absolute',
      'top-0',
      'right-0',
      'h-auto',
      'w-[clamp(760px,calc(100vw-264px),1320px)]',
      'max-w-none'
    );

    const tabletLeft = screen.getByTestId('homepage-hero-tablet-left');
    const tabletRight = screen.getByTestId('homepage-hero-tablet-right');
    expect(tabletLeft).toHaveClass('h-full', 'max-h-[532px]', 'w-auto');
    expect(tabletRight).toHaveClass(
      'absolute',
      'top-0',
      'right-0',
      'h-full',
      'max-h-[532px]',
      'w-auto'
    );

    const mobileLeft = screen.getByTestId('homepage-hero-mobile-left');
    const mobileRight = screen.getByTestId('homepage-hero-mobile-right');
    expect(mobileLeft).toHaveClass('h-full', 'max-h-[532px]', 'w-auto');
    expect(mobileRight).toHaveClass(
      'absolute',
      'top-0',
      'right-0',
      'h-full',
      'max-h-[532px]',
      'w-auto'
    );
  });

  it.each([
    ['guest', GUEST_IDENTITY, '加入 X-Talent', '/auth/signup'],
    [
      'mentee',
      authenticatedIdentity('mentee-12', { isMentor: false }),
      '尋找導師',
      '/mentor-pool',
    ],
    [
      'mentor',
      authenticatedIdentity('mentor-34', { isMentor: true }),
      '尋找導師',
      '/mentor-pool',
    ],
  ] as const)(
    'renders Hero CTA label and destination for %s identity',
    (_role, identity, expectedLabel, expectedHref) => {
      mockUseResolvedIdentity.mockReturnValue(identity);
      render(<HomePageHero />);

      const cta = screen.getByTestId('homepage-cta-hero');
      expect(cta).toHaveTextContent(expectedLabel);
      expect(cta).toHaveAttribute('href', expectedHref);
    }
  );
});
