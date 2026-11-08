import { memo, useEffect, useRef } from 'react';

import { MentorType } from '@/types/mentor';

import { MentorCard } from '../mentor-card';

interface MentorCardListProps {
  mentors: MentorType[];
  onScrollToBottom: () => Promise<void>;
}

const MentorCardListBase = ({
  mentors,
  onScrollToBottom,
}: MentorCardListProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useRef<HTMLElement | null>(null);
  const onScrollToBottomRef = useRef(onScrollToBottom);
  onScrollToBottomRef.current = onScrollToBottom;

  const lastMentorId = mentors.at(-1)?.user_id;

  useEffect(() => {
    observer.current?.disconnect();
    if (lastMentorId === undefined || !lastCardRef.current) {
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
            haveTopicLabels={mentor.have_topic}
            priority={index === 0}
          />
        ))}
      </div>
    </div>
  );
};

export const MentorCardList = memo(MentorCardListBase);
