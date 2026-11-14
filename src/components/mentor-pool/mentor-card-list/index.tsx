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

interface CachedCardTags {
  prioritizedCodes: ReadonlySet<string>;
  labelMap: ReadonlyMap<string, string> | undefined;
  tags: string[];
}

const EMPTY_PRIORITIZED_CODES: ReadonlySet<string> = new Set();

export function buildMentorCardTags(
  mentor: Pick<MentorType, 'have_topic' | 'have_skill'>,
  prioritizedCodes?: ReadonlySet<string>,
  labelMap?: ReadonlyMap<string, string>
): string[] {
  const combinedCodes = Array.from(
    new Set([...(mentor.have_topic ?? []), ...(mentor.have_skill ?? [])])
  ).filter(Boolean);

  let orderedCodes = combinedCodes;
  if (prioritizedCodes && prioritizedCodes.size > 0) {
    const matched: string[] = [];
    const rest: string[] = [];
    for (const code of combinedCodes) {
      if (prioritizedCodes.has(code)) {
        matched.push(code);
      } else {
        rest.push(code);
      }
    }
    orderedCodes = [...matched, ...rest];
  }

  if (!labelMap || labelMap.size === 0) {
    return orderedCodes;
  }

  const resolvedLabels: string[] = [];
  const seenLabels = new Set<string>();
  for (const code of orderedCodes) {
    const label = labelMap.get(code) ?? code;
    if (label && !seenLabels.has(label)) {
      seenLabels.add(label);
      resolvedLabels.push(label);
    }
  }
  return resolvedLabels;
}

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
  const tagCacheRef = useRef<WeakMap<MentorType, CachedCardTags>>(
    new WeakMap()
  );

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

  const getMentorCardTags = (mentor: MentorType): string[] => {
    const cached = tagCacheRef.current.get(mentor);
    if (
      cached &&
      cached.prioritizedCodes === prioritizedCodes &&
      cached.labelMap === labelMap
    ) {
      return cached.tags;
    }
    const tags = buildMentorCardTags(mentor, prioritizedCodes, labelMap);
    tagCacheRef.current.set(mentor, {
      prioritizedCodes,
      labelMap,
      tags,
    });
    return tags;
  };

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
            id={mentor.user_id}
            avatar={mentor.avatar}
            years={mentor.years_of_experience}
            name={mentor.name}
            job_title={mentor.job_title}
            company={mentor.company}
            about={mentor.about}
            haveTopicLabels={getMentorCardTags(mentor)}
            ratingAverage={mentor.stats?.rating_average ?? null}
            completedMeetingCount={
              mentor.stats?.completed_meeting_count ?? null
            }
            priority={index === 0}
            mentorSnapshot={mentor}
          />
        ))}
      </div>
    </div>
  );
};

export const MentorCardList = memo(MentorCardListBase);
