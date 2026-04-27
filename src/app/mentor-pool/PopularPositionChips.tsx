'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { POPULAR_POSITIONS } from './data';
import { buildHref, setSearchPattern } from './searchParams';

export default function PopularPositionChips() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const handleClick = (position: string) => {
    const next = setSearchPattern(params, position);
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  return (
    <div
      className="mx-auto flex w-[338px] justify-center gap-2 overflow-hidden md:w-[688px] xl:w-[846px]"
      aria-label="熱門職位"
    >
      {POPULAR_POSITIONS.map((position) => (
        <button
          key={position}
          type="button"
          onClick={() => handleClick(position)}
          className="shrink-0 rounded-full border border-[#E6E8EA] bg-background-white px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[#F7F2FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {position}
        </button>
      ))}
    </div>
  );
}
