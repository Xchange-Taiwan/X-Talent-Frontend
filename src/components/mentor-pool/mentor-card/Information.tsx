import { useLayoutEffect, useRef, useState } from 'react';

import { Tag } from './Tag';

interface InformationProps {
  name: string;
  job_title: string;
  company: string;
  about: string;
  whatIOffers: string[];
}

const TAG_GAP_PX = 8;
const EXTRA_BADGE_RESERVE_PX = 52;

export const Information = ({
  name,
  job_title,
  company,
  about,
  whatIOffers = [],
}: InformationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<number[]>([]);
  const [visibleTagsCount, setVisibleTagsCount] = useState(whatIOffers.length);

  useLayoutEffect(() => {
    if (!measureRef.current || !containerRef.current) return;

    widthsRef.current = Array.from(measureRef.current.children).map(
      (child) => (child as HTMLElement).getBoundingClientRect().width
    );

    const computeVisible = (containerWidth: number) => {
      const widths = widthsRef.current;
      let total = EXTRA_BADGE_RESERVE_PX;
      let lastIndex = widths.length - 1;
      for (let i = 0; i < widths.length; i++) {
        const gap = i > 0 ? TAG_GAP_PX : 0;
        total += widths[i] + gap;
        if (total > containerWidth) {
          lastIndex = i - 1;
          break;
        }
      }
      setVisibleTagsCount(
        Math.max(0, Math.min(lastIndex + 1, whatIOffers.length))
      );
    };

    computeVisible(containerRef.current.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      computeVisible(entry.contentRect.width);
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [whatIOffers]);

  const visibleOffers = whatIOffers.slice(0, visibleTagsCount);
  const extraOffersCount = whatIOffers.length - visibleTagsCount;

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h3 className="text-base font-bold tracking-[0.5px]">{name}</h3>
        {(job_title || company) && (
          <div className="flex gap-[6px] text-sm font-normal tracking-wide">
            {job_title}
            {job_title && company && <span className="text-[#9DA8B9]">at</span>}
            {company}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-sm font-normal tracking-wide text-[#9DA8B9]">
        {about}
      </p>
      <div className="relative">
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 flex flex-wrap gap-2"
        >
          {whatIOffers.map((offer) => (
            <Tag label={offer} key={`measure-${offer}`} />
          ))}
        </div>
        <div ref={containerRef} className="flex flex-wrap gap-2">
          {visibleOffers.map((offer) => (
            <Tag label={offer} key={offer} />
          ))}
          {extraOffersCount > 0 && (
            <Tag label={`+${extraOffersCount}`} key="extra" />
          )}
        </div>
      </div>
    </div>
  );
};
