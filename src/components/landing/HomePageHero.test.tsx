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

  it('renders edge-anchored left/right art-directed <picture> layers without redundant multi-breakpoint <img> mounts or object-cover center cropping', () => {
    const { container } = render(<HomePageHero />);

    expect(container.querySelectorAll('picture')).toHaveLength(2);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(
      0
    );

    const leftClip = screen.getByTestId('homepage-hero-clip-left');
    const rightClip = screen.getByTestId('homepage-hero-clip-right');
    expect(leftClip).toHaveClass(
      'left-0',
      'w-1/2',
      'max-w-[180px]',
      'sm:max-w-[384px]',
      'lg:max-w-[660px]'
    );
    expect(rightClip).toHaveClass(
      'right-0',
      'w-1/2',
      'max-w-[180px]',
      'sm:max-w-[384px]',
      'lg:max-w-[660px]'
    );

    const leftImage = screen.getByAltText(
      'X-Talent 平台主視覺：專業工作者交流情境'
    );
    expect(leftImage).toHaveAttribute(
      'data-testid',
      'homepage-hero-artwork-left'
    );
    expect(leftImage).toHaveAttribute('loading', 'eager');
    expect(leftImage).toHaveAttribute('fetchpriority', 'high');
    expect(leftImage.getAttribute('src')).toContain(
      '/landing/home-page-hero-sm.svg'
    );
    expect(leftImage).toHaveClass(
      'h-full',
      'max-h-[532px]',
      'w-auto',
      'lg:h-auto',
      'lg:max-h-none',
      'lg:w-[clamp(720px,calc(100vw-304px),1320px)]',
      'max-w-none'
    );
    expect(leftImage).not.toHaveClass('object-cover', 'object-center');

    const rightImage = screen.getByTestId('homepage-hero-artwork-right');
    expect(rightImage).toHaveAttribute('alt', '');
    expect(rightImage).toHaveAttribute('loading', 'eager');
    expect(rightImage).not.toHaveAttribute('fetchpriority');
    expect(rightImage).toHaveClass(
      'absolute',
      'top-0',
      'right-0',
      'h-full',
      'max-h-[532px]',
      'w-auto',
      'lg:h-auto',
      'lg:max-h-none',
      'lg:w-[clamp(720px,calc(100vw-304px),1320px)]',
      'max-w-none'
    );

    for (const picture of Array.from(container.querySelectorAll('picture'))) {
      const sources = picture.querySelectorAll('source');
      expect(sources).toHaveLength(2);
      expect(sources[0]).toHaveAttribute('media', '(min-width: 1024px)');
      expect(sources[0]).toHaveAttribute(
        'sizes',
        '(min-width: 1624px) 1320px, calc(100vw - 304px)'
      );
      expect(sources[0].getAttribute('srcset')).toContain(
        'home-page-hero.webp'
      );
      expect(sources[1]).toHaveAttribute('media', '(min-width: 640px)');
      expect(sources[1].getAttribute('srcset')).toContain(
        '/landing/home-page-hero-md.svg'
      );
    }
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
