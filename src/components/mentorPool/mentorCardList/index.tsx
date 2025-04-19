'use client';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useCallback, useEffect, useRef, useState } from 'react';

import avatarImage from '@/assets/default-avatar.jpeg';

import { MentorCard, MentorCardProps } from '../mentorCard';
interface MentorCardListProps {
  searchTerm?: string;
  filter?: string;
  sortBy?: string;
}

const mokeData: MentorCardProps[] = [
  {
    id: 1,
    avatar: avatarImage,
    years: '10',
    name: 'John Doe',
    position: 'Senior Software Engineer',
    company: 'Microsoft',
    personalStatment:
      'Passionate about building scalable systems and mentoring junior developers.',
    skills: ['System Design', 'Cloud Computing', 'C#'],
  },
  {
    id: 2,
    avatar: avatarImage,
    years: '7',
    name: 'Jane Smith',
    position: 'Data Scientist',
    company: 'Amazon',
    personalStatment:
      'Focused on data-driven decision making and predictive modeling.',
    skills: ['Machine Learning', 'Data Visualization', 'Python'],
  },
  {
    id: 3,
    avatar: avatarImage,
    years: '5',
    name: 'Alice Johnson',
    position: 'Product Manager',
    company: 'Google',
    personalStatment:
      'Dedicated to creating user-centric products that solve real-world problems.',
    skills: ['Product Management', 'Agile Methodologies', 'User Research'],
  },
  {
    id: 4,
    avatar: avatarImage,
    years: '8',
    name: 'Bob Brown',
    position: 'UX Designer',
    company: 'Apple',
    personalStatment:
      'Specialized in crafting intuitive and visually appealing user experiences.',
    skills: ['UI/UX Design', 'Prototyping', 'Figma'],
  },
  {
    id: 5,
    avatar: avatarImage,
    years: '15',
    name: 'Charlie Davis',
    position: 'DevOps Engineer',
    company: 'Netflix',
    personalStatment:
      'Experienced in automating infrastructure and ensuring system reliability.',
    skills: ['CI/CD', 'Kubernetes', 'AWS'],
  },
  {
    id: 6,
    avatar: avatarImage,
    years: '6',
    name: 'Emily Wilson',
    position: 'Frontend Developer',
    company: 'Spotify',
    personalStatment:
      'Enthusiastic about creating responsive and accessible web applications.',
    skills: ['React', 'TypeScript', 'CSS'],
  },
  {
    id: 7,
    avatar: avatarImage,
    years: '12',
    name: 'Frank Thomas',
    position: 'Cybersecurity Specialist',
    company: 'Cisco',
    personalStatment:
      'Committed to protecting systems and data from cyber threats.',
    skills: ['Network Security', 'Penetration Testing', 'Encryption'],
  },
  {
    id: 8,
    avatar: avatarImage,
    years: '9',
    name: 'Grace Lee',
    position: 'AI Researcher',
    company: 'OpenAI',
    personalStatment:
      'Exploring the boundaries of artificial intelligence and its applications.',
    skills: ['Deep Learning', 'Natural Language Processing', 'TensorFlow'],
  },
  {
    id: 9,
    avatar: avatarImage,
    years: '4',
    name: 'Henry White',
    position: 'Mobile App Developer',
    company: 'Snapchat',
    personalStatment:
      'Focused on delivering seamless mobile experiences for users.',
    skills: ['iOS Development', 'Swift', 'UI Design'],
  },
  {
    id: 10,
    avatar: avatarImage,
    years: '20',
    name: 'Ivy Green',
    position: 'CTO',
    company: 'Tesla',
    personalStatment:
      'Leading technology teams to innovate and achieve business goals.',
    skills: ['Leadership', 'Strategic Planning', 'Software Architecture'],
  },
];

export const MentorCardList = ({}: MentorCardListProps) => {
  const [mentorList, setMentorList] = useState<MentorCardProps[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 9;
  const observer = useRef<IntersectionObserver | null>(null);
  const initialLoadDone = useRef(false);

  // temporary mock fetch data function
  const fetchMentorData = useCallback(() => {
    if (!hasMore) {
      observer.current?.disconnect();
      return;
    }
    setIsLoading(true);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, mokeData.length);
    const newData = mokeData.slice(startIndex, endIndex);
    setTimeout(() => {
      setMentorList((prevMentorList) => [...prevMentorList, ...newData]);
      setHasMore(newData.length >= pageSize);
      setIsLoading(false);
    }, 10000); // Simulate network delay
  }, [page, hasMore]);

  useEffect(() => {
    if (page === 1) {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        fetchMentorData();
      }
    } else {
      fetchMentorData();
    }
  }, [fetchMentorData, page]);

  const lastCardRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading || !hasMore) return;
      observer.current?.disconnect();
      if (node) {
        observer.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && hasMore) {
              setPage((prevPage) => prevPage + 1);
            }
          },
          { threshold: 0.5 },
        );
        observer.current?.observe(node);
      }
    },
    [isLoading, hasMore],
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {mentorList.map((mentor, index) => (
          <MentorCard
            ref={index === mentorList.length - 1 ? lastCardRef : null}
            key={mentor.id}
            id={mentor.id}
            avatar={mentor.avatar}
            years={mentor.years}
            name={mentor.name}
            position={mentor.position}
            company={mentor.company}
            personalStatment={mentor.personalStatment}
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
