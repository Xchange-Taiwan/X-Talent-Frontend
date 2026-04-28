'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const widths = buttonRefs.current.map((b) => b?.offsetWidth ?? 0);
    let total = 0;
    let count = 0;
    for (let i = 0; i < widths.length; i++) {
      const next = total + widths[i] + (count > 0 ? GAP_PX : 0);
      if (next > DESKTOP_WIDTH) break;
      total = next;
      count++;
    }
    setVisibleCount(count);
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
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] xl:mx-auto xl:w-[846px] xl:justify-center xl:overflow-x-visible [&::-webkit-scrollbar]:hidden"
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
            className={`shrink-0 rounded-full border border-[#E6E8EA] bg-background-white px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[#F7F2FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          className="to-transparent pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-start bg-gradient-to-r from-background-white xl:hidden"
        >
          <ChevronLeft className="h-4 w-4 text-foreground/60" />
        </div>
      )}
      {canScrollRight && (
        <div
          aria-hidden
          className="to-transparent pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-background-white xl:hidden"
        >
          <ChevronRight className="h-4 w-4 text-foreground/60" />
        </div>
      )}
    </div>
  );
}
