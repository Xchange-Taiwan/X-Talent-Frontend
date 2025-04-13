'use client';
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
    years: '3',
    name: '陳小明',
    position: '資深產品經理',
    company: '台灣大哥大',
    personalStatment: '專注於產品設計與用戶體驗，熱愛分享與交流。',
    skills: ['產品設計', '用戶研究', '數據分析'],
  },
  {
    id: 2,
    avatar: avatarImage,
    years: '5',
    name: '李小華',
    position: '行銷總監',
    company: '聯發科技',
    personalStatment: '專注於數位行銷與品牌策略，喜歡與人交流。',
    skills: ['數位行銷', '品牌策略', '社群媒體'],
  },
  {
    id: 3,
    avatar: avatarImage,
    years: '2',
    name: '王小美',
    position: '數據科學家',
    company: '台積電',
    personalStatment: '專注於數據分析與機器學習，熱愛解決問題。',
    skills: ['數據分析', '機器學習', 'Python'],
  },
  {
    id: 4,
    avatar: avatarImage,
    years: '4',
    name: '蕭雲',
    position: '軟體工程師',
    company: '宏達電',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
  },
  {
    id: 5,
    avatar: avatarImage,
    years: '24',
    name: '霍華德',
    position: '軟體工程師',
    company: '中國信託',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
  },
  {
    id: 6,
    avatar: avatarImage,
    years: '4',
    name: '張小強',
    position: '軟體工程師',
    company: '宏達電',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
  },
  {
    id: 7,
    avatar: avatarImage,
    years: '4年',
    name: '張小強',
    position: '軟體工程師',
    company: '宏達電',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
  },
  {
    id: 8,
    avatar: avatarImage,
    years: '4年',
    name: '張小強',
    position: '軟體工程師',
    company: '宏達電',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
  },
  {
    id: 9,
    avatar: avatarImage,
    years: '18',
    name: '張小強',
    position: '軟體工程師',
    company: '宏達電',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
  },
  {
    id: 10,
    avatar: avatarImage,
    years: '3',
    name: '阿明',
    position: '軟體工程師',
    company: '宏達電',
    personalStatment: '專注於後端開發與系統架構設計，喜歡挑戰新技術。',
    skills: ['後端開發', '系統架構', '雲端運算'],
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
    setMentorList((prevMentorList) => [...prevMentorList, ...newData]);
    setHasMore(newData.length >= pageSize);
    setIsLoading(false);
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
  );
};
