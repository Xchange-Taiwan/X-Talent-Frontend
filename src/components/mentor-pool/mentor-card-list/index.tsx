import { memo, useEffect, useMemo, useRef } from 'react';

import type { ActiveFilterBadge } from '@/app/mentor-pool/searchParams';
import { MentorType } from '@/types/mentor';

import { MentorCard } from '../mentor-card';

interface MentorCardListProps {
  mentors: MentorType[];
  onScrollToBottom: () => Promise<void>;
  activeFilterBadges?: ActiveFilterBadge[];
}

export function buildMentorCardTags(
  mentor: Pick<MentorType, 'have_topic' | 'have_skill'>,
  prioritizedLabels?: ReadonlySet<string>
): string[] {
  const combined = Array.from(
    new Set([...(mentor.have_topic ?? []), ...(mentor.have_skill ?? [])])
  ).filter(Boolean);

  if (!prioritizedLabels || prioritizedLabels.size === 0) {
    return combined;
  }

  const matched: string[] = [];
  const rest: string[] = [];
  for (const tag of combined) {
    if (prioritizedLabels.has(tag)) {
      matched.push(tag);
    } else {
      rest.push(tag);
    }
  }
  return [...matched, ...rest];
}

const MentorCardListBase = ({
  mentors,
  onScrollToBottom,
  activeFilterBadges,
}: MentorCardListProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useRef<HTMLElement | null>(null);
  const onScrollToBottomRef = useRef(onScrollToBottom);
  onScrollToBottomRef.current = onScrollToBottom;

  const prioritizedLabels = useMemo(() => {
    const set = new Set<string>();
    for (const badge of activeFilterBadges ?? []) {
      if (badge.key === 'filter_topics' || badge.key === 'filter_skills') {
        if (badge.label) set.add(badge.label);
        if (badge.value) set.add(badge.value);
      }
    }
    return set;
  }, [activeFilterBadges]);

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
            haveTopicLabels={buildMentorCardTags(mentor, prioritizedLabels)}
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
