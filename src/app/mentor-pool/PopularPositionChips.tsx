'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { POPULAR_POSITIONS } from './data';
import { buildHref, setSearchPattern } from './searchParams';

// Desktop SearchBar width is the source of truth. We measure each chip on
// mount and trim to what fits in this width on xl. Below xl, all chips are
// shown in a single horizontal-scroll row with a right-edge fade.
const DESKTOP_WIDTH = 846;
const GAP_PX = 8;

export default function PopularPositionChips() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [visibleCount, setVisibleCount] = useState(POPULAR_POSITIONS.length);

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

  const handleClick = (position: string) => {
    const next = setSearchPattern(params, position);
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  return (
    <div className="relative">
      <div
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
      <div
        aria-hidden
        className="to-transparent pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background-white xl:hidden"
      />
    </div>
  );
}
