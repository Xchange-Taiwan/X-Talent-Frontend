import { useEffect, useRef } from 'react';

import { MentorType } from '@/services/searchMentor/mentors';

import { MentorCard } from '../mentorCard';

interface MentorCardListProps {
  mentors: MentorType[];
  onScrollToBottom: () => Promise<void>;
}

export const MentorCardList = ({
  mentors,
  onScrollToBottom,
}: MentorCardListProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastCardRef = useRef<HTMLElement | null>(null);

  const fetchMentorData = async () => {
    await onScrollToBottom();
  };

  useEffect(() => {
    observer.current?.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMentorData();
        }
      },
      { threshold: 0.5 },
    );

    if (lastCardRef.current) {
      observer.current.observe(lastCardRef.current);
    }

    return () => {
      observer.current?.disconnect();
    };
  }, [mentors]);

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
            personalStatment={mentor.personal_statement}
            skills={mentor.skills}
          />
        ))}
      </div>
    </div>
  );
};
