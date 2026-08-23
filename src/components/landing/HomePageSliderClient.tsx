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
        className="bg-background-bottom-secondary h-[520px] w-full animate-pulse rounded-md sm:h-[280px]"
      />
    ),
  }
);
