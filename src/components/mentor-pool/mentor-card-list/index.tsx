import { memo, useEffect, useMemo, useRef } from 'react';

import { EMPTY_PRIORITIZED_CARD_TAG_CODES } from '@/lib/mentor/mentorPoolQuery';
import type { MentorType } from '@/types/mentor';

import { MentorCard } from '../mentor-card';

interface MentorCardListProps {
  mentors: MentorType[];
  onScrollToBottom: () => Promise<void>;
  prioritizedCardTagCodes?: ReadonlySet<string> | ReadonlyArray<string>;
  labelMap?: ReadonlyMap<string, string>;
}

const MentorCardListBase = ({
  mentors,
  onScrollToBottom,
  prioritizedCardTagCodes,
  labelMap,
}: MentorCardListProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useRef<HTMLElement | null>(null);
  const onScrollToBottomRef = useRef(onScrollToBottom);
  onScrollToBottomRef.current = onScrollToBottom;

  const prioritizedCodesKey = useMemo(() => {
    if (!prioritizedCardTagCodes) return '';
    const codes = Array.from(prioritizedCardTagCodes).filter(Boolean);
    return codes.length > 0 ? codes.sort().join('\0') : '';
  }, [prioritizedCardTagCodes]);

  const prioritizedCodes = useMemo<ReadonlySet<string>>(
    () =>
      prioritizedCodesKey
        ? new Set(prioritizedCodesKey.split('\0'))
        : EMPTY_PRIORITIZED_CARD_TAG_CODES,
    [prioritizedCodesKey]
  );

  const lastMentorId = mentors.at(-1)?.user_id;

  useEffect(() => {
    observer.current?.disconnect();
    if (
      lastMentorId === undefined ||
      !lastCardRef.current ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void onScrollToBottomRef.current();
        }
      },
      { threshold: 0.5 }
    );

    observer.current.observe(lastCardRef.current);

    return () => {
      observer.current?.disconnect();
    };
  }, [lastMentorId]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid min-w-max grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {mentors.map((mentor, index) => (
          <MentorCard
            ref={index === mentors.length - 1 ? lastCardRef : null}
            key={mentor.user_id}
            mentor={mentor}
            prioritizedCodes={prioritizedCodes}
            labelMap={labelMap}
            priority={index === 0}
          />
        ))}
      </div>
    </div>
  );
};

export const MentorCardList = memo(MentorCardListBase);
