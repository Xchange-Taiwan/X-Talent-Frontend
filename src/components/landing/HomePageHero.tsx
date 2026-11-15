import { getImageProps } from 'next/image';
import * as React from 'react';

import { HomePageCtaButton } from '@/components/landing/HomePageCtaButton';
import { cn } from '@/lib/utils';

const DESKTOP_HERO_SIZES = '(min-width: 1624px) 1320px, calc(100vw - 304px)';

const SUPPORTS_CAMEL_CASE_FETCH_PRIORITY = 'use' in React;
const HIGH_FETCH_PRIORITY_PROPS: React.ImgHTMLAttributes<HTMLImageElement> & {
  fetchpriority?: 'high';
} = SUPPORTS_CAMEL_CASE_FETCH_PRIORITY
  ? { fetchPriority: 'high' }
  : { fetchpriority: 'high' };

const ARTWORK_IMAGE_CLASS =
  'h-full max-h-[532px] w-auto max-w-none select-none lg:h-auto lg:max-h-none lg:w-[clamp(720px,calc(100vw-304px),1320px)]';

export interface HomePageHeroProps {
  className?: string;
}

export function HomePageHero({
  className,
}: HomePageHeroProps): React.ReactElement {
  const { props: desktopProps } = getImageProps({
    src: '/landing/home-page-hero.webp',
    alt: '',
    width: 7424,
    height: 4200,
    sizes: DESKTOP_HERO_SIZES,
  });

  const { props: tabletProps } = getImageProps({
    src: '/landing/home-page-hero-md.svg',
    alt: '',
    width: 768,
    height: 532,
    unoptimized: true,
  });

  const { props: mobileProps } = getImageProps({
    src: '/landing/home-page-hero-sm.svg',
    alt: '',
    width: 360,
    height: 532,
    unoptimized: true,
  });

  const tabletSrcSet = tabletProps.srcSet ?? tabletProps.src;

  return (
    <section
      data-testid="homepage-hero"
      className={cn(
        'relative isolate flex min-h-[clamp(360px,calc(100svh-70px),520px)] w-full flex-col items-center justify-center overflow-hidden px-6 py-8 text-center sm:px-8 sm:py-10 lg:min-h-[clamp(480px,calc(100svh-70px),600px)] lg:py-16',
        className
      )}
    >
      <h1 className="text-navy mb-4 text-3xl leading-[44px] font-bold sm:mb-5 sm:text-4xl sm:leading-tight md:text-5xl lg:mb-6">
        交流讓
        <br className="md:hidden" />
        改變發生
      </h1>
      <p className="text-text-primary max-w-[320px] text-lg leading-7 md:max-w-[420px] md:text-xl md:leading-8 lg:max-w-[520px] lg:text-2xl lg:leading-9">
        Find your Mentor/Mentee to build up connections, break up limits.
      </p>
      <div className="mt-6 sm:mt-7 lg:mt-8">
        <HomePageCtaButton variant="hero" />
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          data-testid="homepage-hero-clip-left"
          className="absolute inset-y-0 left-0 w-1/2 max-w-[180px] overflow-hidden sm:max-w-[384px] lg:max-w-[660px]"
        >
          <picture className="block h-full w-full">
            <source
              media="(min-width: 1024px)"
              srcSet={desktopProps.srcSet}
              sizes={desktopProps.sizes}
              width={desktopProps.width}
              height={desktopProps.height}
            />
            <source
              media="(min-width: 640px)"
              srcSet={tabletSrcSet}
              width={tabletProps.width}
              height={tabletProps.height}
            />
            <img
              {...HIGH_FETCH_PRIORITY_PROPS}
              loading="eager"
              decoding={mobileProps.decoding}
              width={mobileProps.width}
              height={mobileProps.height}
              src={mobileProps.src}
              alt="X-Talent 平台主視覺：專業工作者交流情境"
              data-testid="homepage-hero-artwork-left"
              className={ARTWORK_IMAGE_CLASS}
            />
          </picture>
        </div>

        <div
          data-testid="homepage-hero-clip-right"
          className="absolute inset-y-0 right-0 w-1/2 max-w-[180px] overflow-hidden sm:max-w-[384px] lg:max-w-[660px]"
        >
          <picture className="block h-full w-full">
            <source
              media="(min-width: 1024px)"
              srcSet={desktopProps.srcSet}
              sizes={desktopProps.sizes}
              width={desktopProps.width}
              height={desktopProps.height}
            />
            <source
              media="(min-width: 640px)"
              srcSet={tabletSrcSet}
              width={tabletProps.width}
              height={tabletProps.height}
            />
            <img
              loading="eager"
              decoding={mobileProps.decoding}
              width={mobileProps.width}
              height={mobileProps.height}
              src={mobileProps.src}
              alt=""
              role="presentation"
              data-testid="homepage-hero-artwork-right"
              className={cn('absolute top-0 right-0', ARTWORK_IMAGE_CLASS)}
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
