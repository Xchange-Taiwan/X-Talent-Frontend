'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { computeOverflowFit } from '@/lib/overflowFit';

import { POPULAR_POSITIONS } from './data';
import { buildHref, setSearchPattern } from './searchParams';

// Desktop SearchBar width is the source of truth. We measure each chip on
// mount and trim to what fits in this width on xl. Below xl, all chips are
// shown in a single horizontal-scroll row with edge fades + chevrons that
// reflect remaining scrollable content on each side.
const DESKTOP_WIDTH = 846;
const GAP_PX = 8;

export default function PopularPositionChips() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(POPULAR_POSITIONS.length);
  const [isMeasured, setIsMeasured] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const widths = buttonRefs.current.map((b) => b?.offsetWidth ?? 0);
    const { visibleCount: computedCount } = computeOverflowFit({
      itemWidths: widths,
      containerWidth: DESKTOP_WIDTH,
      gapPx: GAP_PX,
      reservePx: 0,
      defaultVisibleCount: POPULAR_POSITIONS.length,
    });
    setVisibleCount(computedCount);
    setIsMeasured(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    };
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  const handleClick = (position: string) => {
    const next = setSearchPattern(params, position);
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  return (
    <div
      className={`relative transition-opacity duration-150 ${isMeasured ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        ref={scrollRef}
        className="flex [scrollbar-width:none] gap-2 overflow-x-auto [-ms-overflow-style:none] xl:mx-auto xl:w-[846px] xl:justify-center xl:overflow-x-visible [&::-webkit-scrollbar]:hidden"
        aria-label="熱門職位"
      >
        {POPULAR_POSITIONS.map((position, i) => (
          <button
            key={position}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            onClick={() => handleClick(position)}
            className={`shrink-0 rounded-full border border-background-border bg-background-white px-4 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-landingPurpleLight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              i >= visibleCount ? 'xl:hidden' : ''
            }`}
          >
            {position}
          </button>
        ))}
      </div>
      {canScrollLeft && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-start bg-gradient-to-r from-background-white to-transparent xl:hidden"
        >
          <ChevronLeft className="size-4 text-text-primary/60" />
        </div>
      )}
      {canScrollRight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-background-white to-transparent xl:hidden"
        >
          <ChevronRight className="size-4 text-text-primary/60" />
        </div>
      )}
    </div>
  );
}
