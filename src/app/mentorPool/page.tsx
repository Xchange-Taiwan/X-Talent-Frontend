'use client';

import { XIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import avatarImage from '@/assets/default-avatar.jpeg';
import {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/mentorFilterDropdown';
import MentorFilterDropdown from '@/components/filter/mentorFilterDropdown';
import { MentorCardList } from '@/components/mentorPool/mentorCardList';
import { Badge } from '@/components/ui/badge';
import SearchBar from '@/components/ui/searchBar';
import { fetchMentors, MentorType } from '@/services/searchMentor/mentors';

const filterOptions: FilterOptions = {
  filter_positions: {
    name: 'Position',
    options: [
      { label: 'Frontend Developer', value: 'Frontend Developer' },
      { label: 'Software Engineer', value: 'Software Engineer' },
      { label: 'Bioinformatics Analyst', value: 'Bioinformatics Analyst' },
      { label: 'Infrastructure Engineer', value: 'Infrastructure Engineer' },
    ],
  },
  filter_skills: {
    name: 'Skill',
    options: [
      { label: 'Kubernetes', value: 'Kubernetes' },
      { label: 'Agile', value: 'Agile' },
      { label: 'Go', value: 'Go' },
      { label: 'Kafka', value: 'Kafka' },
      { label: 'Financial Modeling', value: 'Financial Modeling' },
      { label: 'Java', value: 'Java' },
    ],
  },
  filter_topics: {
    name: 'Topic',
    options: [
      { label: 'Microservices', value: 'Microservices' },
      { label: 'User Research', value: 'User Research' },
      { label: 'System Design', value: 'System Design' },
      { label: 'DevOps', value: 'DevOps' },
    ],
  },
  filter_expertises: {
    name: 'Expertise',
    options: [
      { label: 'DevOps', value: 'DevOps' },
      { label: 'Full Stack Development', value: 'Full Stack Development' },
      { label: 'DevStart', value: 'DevStart' },
      { label: 'Backend Development', value: 'Backend Development' },
    ],
  },
  filter_industries: {
    name: 'Industry',
    options: [
      { label: 'Technology', value: 'Technology' },
      { label: 'Healthcare', value: 'Healthcare' },
      { label: 'Finance', value: 'Finance' },
    ],
  },
};

const MentorPool = () => {
  const [searchPattern, setSearchPattern] = useState('');
  const [mentorCount, setMentorCount] = useState<number>(0);
  const [mentors, setMentors] = useState<MentorType[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<SelectFilters>({});
  const [isNoResults, setIsNoResults] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>('');
  const limit = 9;

  const handleFilterChange = (options: SelectFilters) => {
    setSelectedFilters(options);
  };

  const handleSearch = async (queryWords: string) => {
    setSearchPattern(queryWords);
  };

  const handleScrollToBottom = async () => {
    if (mentors.length < limit) return;
    fetchMoreMentors();
  };

  const fetchMentorsBySearch = useCallback(async () => {
    const filters = Object.fromEntries(
      Object.entries(selectedFilters).map(([key, value]) => [key, value.value]),
    );
    const param = {
      searchPattern,
      limit,
      cursor: '',
      ...filters,
    };
    const rtnList = await fetchMentors(param);
    if (rtnList.length > 0) {
      rtnList.map((mentor) => {
        mentor.avatar = avatarImage;
      });
      setMentors(rtnList);
      setMentorCount(rtnList.length);
      setCursor(rtnList.at(-1)?.updated_at?.toString());
      setIsNoResults(false);
      return;
    }
    setMentors([]);
    setMentorCount(0);
    setIsNoResults(true);
  }, [searchPattern, limit, selectedFilters]);

  const fetchMoreMentors = async () => {
    const filters = Object.fromEntries(
      Object.entries(selectedFilters).map(([key, value]) => [key, value.value]),
    );
    const param = {
      searchPattern,
      limit,
      cursor,
      ...filters,
    };
    const rtnList = await fetchMentors(param);
    if (rtnList.length > 0) {
      rtnList.map((mentor) => {
        mentor.avatar = avatarImage;
      });
      setMentors((prevMentors) => [...prevMentors, ...rtnList]);
      setMentorCount(mentorCount + rtnList.length);
      setCursor(rtnList.at(-1)?.updated_at?.toString());
      return;
    }
    setIsNoResults(true);
  };

  useEffect(() => {
    fetchMentorsBySearch();
  }, [fetchMentorsBySearch]);

  function removeFilter(key: string) {
    setSelectedFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      delete newFilters[key];
      return newFilters;
    });
  }
  return (
    <div className="relative">
      <section className="flex h-[202px] w-full items-center justify-center bg-[linear-gradient(to_right,#FFFFEF_0%,#FFF6FF_19%,#F7F2FB_42%,#E4FFFF_100%)] text-3xl font-semibold xl:rounded-br-[120px]">
        Level up your career
        <br className="block md:hidden" /> with Mentors!
      </section>
      <div className="absolute left-[calc(50%-169px)] top-[172px] h-20 w-[338px] md:left-[calc(50%-344px)] md:w-[688px] xl:left-[calc(50%-423px)] xl:w-[846px]">
        <SearchBar onSearch={handleSearch} />
      </div>
      <section className="mt-[132px] px-5 pb-10 md:px-10 xl:px-20">
        <div className="mx-auto w-full max-w-[1280px] ">
          <div className="item-center mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="text-base">{mentorCount} mentors were found</div>
            <div className="grid w-full grid-cols-2 gap-3 md:flex md:w-fit">
              <div className="block md:hidden"></div>
              <MentorFilterDropdown
                onChange={handleFilterChange}
                filterOptions={filterOptions}
                selectOptions={selectedFilters}
              />
            </div>
          </div>
          <div className="mb-5 flex flex-wrap gap-3">
            {Object.entries(selectedFilters).map(([key, filter]) => (
              <Badge
                key={key}
                variant={'filter'}
                className="text-sm font-medium leading-5"
              >
                <span>
                  {filter.name}: {filter.value}
                </span>
                <XIcon
                  className="h-4 w-4 cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFilter(key);
                  }}
                />
              </Badge>
            ))}
          </div>

          {mentors.length === 0 ? (
            <div className="flex h-72 w-full items-center justify-center">
              {isNoResults && (
                <span className="text-3xl">No results found</span>
              )}
            </div>
          ) : (
            <MentorCardList
              mentors={mentors}
              onScrollToBottom={handleScrollToBottom}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default MentorPool;
