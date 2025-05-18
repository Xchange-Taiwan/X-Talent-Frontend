import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useEffect, useRef, useState } from 'react';

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
  const [isLoading, setIsLoading] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const fetchMentorData = async () => {
    setIsLoading(true);
    try {
      await onScrollToBottom();
    } catch (error) {
      console.error('Error fetching mentor data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      observer.current?.disconnect();
    };
  }, []);

  const lastCardRef = (node: HTMLElement | null) => {
    if (node) {
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            fetchMentorData();
          }
        },
        { threshold: 0.5 },
      );
      observer.current?.observe(node);
    }
  };

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
      {isLoading && <LoadingIcon />}
    </div>
  );
};

const LoadingIcon = () => {
  return (
    <Box sx={{ position: 'relative' }}>
      <CircularProgress
        variant="determinate"
        sx={() => ({
          color: '#F0F6F6',
        })}
        size={40}
        thickness={4}
        value={100}
      />
      <CircularProgress
        variant="indeterminate"
        disableShrink
        sx={() => ({
          color: '#BEDEDE',
          animationDuration: '550ms',
          position: 'absolute',
          left: 0,
        })}
        size={40}
        thickness={4}
      />
    </Box>
  );
};
