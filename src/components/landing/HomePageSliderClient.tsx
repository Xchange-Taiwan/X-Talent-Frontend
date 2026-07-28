'use client';
import dynamic from 'next/dynamic';

export const HomePageSliderClient = dynamic(
  () =>
    import('@/components/landing/HomePageSlider').then(
      (mod) => mod.HomePageSlider
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="h-[520px] w-full animate-pulse rounded-md bg-background-bottom-secondary sm:h-[280px]"
      />
    ),
  }
);
