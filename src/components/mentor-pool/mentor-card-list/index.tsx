import { memo, useEffect, useMemo, useRef } from 'react';

import type { ActiveFilterBadge } from '@/app/mentor-pool/searchParams';
import type { MentorType } from '@/types/mentor';

import { MentorCard } from '../mentor-card';

interface MentorCardListProps {
  mentors: MentorType[];
  onScrollToBottom: () => Promise<void>;
  activeFilterBadges?: ActiveFilterBadge[];
  labelMap?: ReadonlyMap<string, string>;
}

const EMPTY_PRIORITIZED_CODES: ReadonlySet<string> = new Set();

const MentorCardListBase = ({
  mentors,
  onScrollToBottom,
  activeFilterBadges,
  labelMap,
}: MentorCardListProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useRef<HTMLElement | null>(null);
  const onScrollToBottomRef = useRef(onScrollToBottom);
  onScrollToBottomRef.current = onScrollToBottom;

  const prioritizedCodesKey = (activeFilterBadges ?? [])
    .filter(
      (badge) =>
        (badge.key === 'filter_topics' || badge.key === 'filter_skills') &&
        Boolean(badge.value)
    )
    .flatMap((badge) =>
      badge.value
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
    )
    .sort()
    .join(',');

  const prioritizedCodes = useMemo<ReadonlySet<string>>(
    () =>
      prioritizedCodesKey
        ? new Set(prioritizedCodesKey.split(','))
        : EMPTY_PRIORITIZED_CODES,
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
