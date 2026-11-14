import Image from 'next/image';

import { HomePageCtaButton } from '@/components/landing/HomePageCtaButton';
import { cn } from '@/lib/utils';

const DESKTOP_HERO_SIZES =
  '(min-width: 1584px) 1320px, (min-width: 1024px) calc(100vw - 264px), 1px';

export interface HomePageHeroProps {
  className?: string;
}

export function HomePageHero({ className }: HomePageHeroProps): JSX.Element {
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
        <div className="absolute inset-y-0 left-0 w-1/2 max-w-[180px] overflow-hidden sm:hidden">
          <Image
            src="/landing/home-page-hero-sm.svg"
            alt=""
            role="presentation"
            width={360}
            height={532}
            unoptimized
            data-testid="homepage-hero-mobile-left"
            className="h-full max-h-[532px] w-auto max-w-none select-none"
          />
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 max-w-[180px] overflow-hidden sm:hidden">
          <Image
            src="/landing/home-page-hero-sm.svg"
            alt=""
            role="presentation"
            width={360}
            height={532}
            unoptimized
            data-testid="homepage-hero-mobile-right"
            className="absolute top-0 right-0 h-full max-h-[532px] w-auto max-w-none select-none"
          />
        </div>

        <div className="absolute inset-y-0 left-0 hidden w-1/2 max-w-[384px] overflow-hidden sm:block lg:hidden">
          <Image
            src="/landing/home-page-hero-md.svg"
            alt=""
            role="presentation"
            width={768}
            height={532}
            unoptimized
            data-testid="homepage-hero-tablet-left"
            className="h-full max-h-[532px] w-auto max-w-none select-none"
          />
        </div>
        <div className="absolute inset-y-0 right-0 hidden w-1/2 max-w-[384px] overflow-hidden sm:block lg:hidden">
          <Image
            src="/landing/home-page-hero-md.svg"
            alt=""
            role="presentation"
            width={768}
            height={532}
            unoptimized
            data-testid="homepage-hero-tablet-right"
            className="absolute top-0 right-0 h-full max-h-[532px] w-auto max-w-none select-none"
          />
        </div>

        <div className="absolute inset-y-0 left-0 hidden w-1/2 max-w-[660px] overflow-hidden lg:block">
          <Image
            src="/landing/home-page-hero.webp"
            alt="X-Talent 平台主視覺：專業工作者交流情境"
            width={7424}
            height={4200}
            sizes={DESKTOP_HERO_SIZES}
            priority
            data-testid="homepage-hero-desktop-left"
            className="h-auto w-[clamp(760px,calc(100vw-264px),1320px)] max-w-none select-none"
          />
        </div>
        <div className="absolute inset-y-0 right-0 hidden w-1/2 max-w-[660px] overflow-hidden lg:block">
          <Image
            src="/landing/home-page-hero.webp"
            alt=""
            role="presentation"
            width={7424}
            height={4200}
            sizes={DESKTOP_HERO_SIZES}
            priority
            data-testid="homepage-hero-desktop-right"
            className="absolute top-0 right-0 h-auto w-[clamp(760px,calc(100vw-264px),1320px)] max-w-none select-none"
          />
        </div>
      </div>
    </section>
  );
}
