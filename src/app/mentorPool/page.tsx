'use client';

import { useEffect, useState } from 'react';

import avatarImage from '@/assets/default-avatar.jpeg';
import { FilterOptions } from '@/components/filter/mentorFilterDropdown';
import MentorFilterDropdown from '@/components/filter/mentorFilterDropdown';
import { MentorCardList } from '@/components/mentorPool/mentorCardList';
import SearchBar from '@/components/ui/searchBar';
import { MentorType } from '@/services/searchMentor/mentors';

const filterOptions: FilterOptions = {
  years_of_experience: {
    name: 'choose years of experience',
    options: [
      { label: '5', value: '5' },
      { label: '10', value: '10' },
      { label: '15', value: '15' },
    ],
  },
  industry: {
    name: 'Industry',
    options: [
      { label: 'industry1', value: '0' },
      { label: 'industry2', value: '1' },
      { label: 'industry3', value: '2' },
    ],
  },
};

const mockMentors: MentorType[] = [
  {
    user_id: 1,
    name: 'John Doe',
    avatar: avatarImage.src,
    job_title: 'Senior Software Engineer',
    company: 'Microsoft',
    years_of_experience: '10',
    location: 'Seattle, WA',
    linkedin_profile: 'https://www.linkedin.com/in/johndoe/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 1,
      category: '2',
      language: 'chinese',
      subject_group: '1',
      subject: '1',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement:
      'I am a software engineer with a passion for mentoring.',
    about:
      'I have worked on various projects in the tech industry and love sharing my knowledge with others.',
    seniority_level: 'Senior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 100,
  },
  {
    user_id: 2,
    name: 'Jane Smith',
    avatar: avatarImage.src,
    job_title: 'Data Scientist',
    company: 'Amazon',
    years_of_experience: '10',
    location: 'Seattle, WA',
    linkedin_profile: 'https://www.linkedin.com/in/janesmith/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 2,
      category: '2',
      language: 'chinese',
      subject_group: '1',
      subject: '1',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'I specialize in data analysis and machine learning.',
    about:
      'I have a strong background in statistics and enjoy helping others understand data science concepts.',
    seniority_level: 'Mid-level',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 50,
  },
  {
    user_id: 3,
    name: 'Alice Johnson',
    avatar: avatarImage.src,
    job_title: 'Product Manager',
    company: 'Google',
    years_of_experience: '10',
    location: 'Mountain View, CA',
    linkedin_profile: 'https://www.linkedin.com/in/alicejohnson/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 3,
      category: '2',
      language: 'chinese',
      subject_group: '1',
      subject: '1',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement:
      'I have a passion for product development and user experience.',
    about:
      'I have worked on various products and enjoy collaborating with cross-functional teams.',
    seniority_level: 'Senior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 75,
  },
  {
    user_id: 4,
    name: 'Bob Williams',
    avatar: avatarImage.src,
    job_title: 'Software Engineer',
    company: 'Facebook',
    years_of_experience: '10',
    location: 'Menlo Park, CA',
    linkedin_profile: 'https://www.linkedin.com/in/bobwilliams/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 4,
      category: '1',
      language: 'english',
      subject_group: '2',
      subject: '3',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement:
      'Experienced in backend development and scalable systems.',
    about: 'Building robust and efficient software solutions.',
    seniority_level: 'Mid-Level',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 90,
  },
  {
    user_id: 5,
    name: 'Charlie Brown',
    avatar: avatarImage.src,
    job_title: 'Data Scientist',
    company: 'Netflix',
    years_of_experience: '10',
    location: 'Los Gatos, CA',
    linkedin_profile: 'https://www.linkedin.com/in/charliebrown/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 5,
      category: '3',
      language: 'chinese',
      subject_group: '1',
      subject: '2',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement:
      'Analyzing data to uncover insights and drive decisions.',
    about: 'Passionate about machine learning and statistical modeling.',
    seniority_level: 'Junior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 60,
  },
  {
    user_id: 6,
    name: 'David Miller',
    avatar: avatarImage.src,
    job_title: 'UX Designer',
    company: 'Apple',
    years_of_experience: '10',
    location: 'Cupertino, CA',
    linkedin_profile: 'https://www.linkedin.com/in/davidmiller/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 6,
      category: '1',
      language: 'english',
      subject_group: '3',
      subject: '1',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'Crafting intuitive and delightful user experiences.',
    about: 'Focusing on user research and interface design.',
    seniority_level: 'Senior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 85,
  },
  {
    user_id: 7,
    name: 'Eva Green',
    avatar: avatarImage.src,
    job_title: 'Frontend Developer',
    company: 'Spotify',
    years_of_experience: '10',
    location: 'New York, NY',
    linkedin_profile: 'https://www.linkedin.com/in/evagreen/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 7,
      category: '2',
      language: 'chinese',
      subject_group: '2',
      subject: '2',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'Building beautiful and responsive web applications.',
    about: 'Specializing in React and modern JavaScript frameworks.',
    seniority_level: 'Mid-Level',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 70,
  },
  {
    user_id: 8,
    name: 'Frank White',
    avatar: avatarImage.src,
    job_title: 'DevOps Engineer',
    company: 'Cisco',
    years_of_experience: '10',
    location: 'San Jose, CA',
    linkedin_profile: 'https://www.linkedin.com/in/frankwhite/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 8,
      category: '3',
      language: 'english',
      subject_group: '1',
      subject: '1',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement:
      'Automating infrastructure and streamlining deployments.',
    about: 'Ensuring system reliability and scalability.',
    seniority_level: 'Senior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 95,
  },
  {
    user_id: 9,
    name: 'Grace Lee',
    avatar: avatarImage.src,
    job_title: 'Mobile Developer',
    company: 'Snapchat',
    years_of_experience: '10',
    location: 'Los Angeles, CA',
    linkedin_profile: 'https://www.linkedin.com/in/gracelee/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 9,
      category: '1',
      language: 'chinese',
      subject_group: '3',
      subject: '2',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'Building engaging and performant mobile applications.',
    about: 'Specializing in iOS and Android development.',
    seniority_level: 'Junior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 55,
  },
  {
    user_id: 10,
    name: 'Henry Kim',
    avatar: avatarImage.src,
    job_title: 'Cybersecurity Specialist',
    company: 'Cisco',
    years_of_experience: '10',
    location: 'San Jose, CA',
    linkedin_profile: 'https://www.linkedin.com/in/henrykim/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 10,
      category: '2',
      language: 'english',
      subject_group: '1',
      subject: '3',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'Protecting digital assets and systems.',
    about: 'Focusing on network security and threat detection.',
    seniority_level: 'Senior',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 88,
  },
  {
    user_id: 11,
    name: 'Ivy Chen',
    avatar: avatarImage.src,
    job_title: 'AI Researcher',
    company: 'OpenAI',
    years_of_experience: '10',
    location: 'San Francisco, CA',
    linkedin_profile: 'https://www.linkedin.com/in/ivychen/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 11,
      category: '3',
      language: 'chinese',
      subject_group: '2',
      subject: '1',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'Advancing the field of artificial intelligence.',
    about: 'Working on cutting-edge machine learning models.',
    seniority_level: 'Mid-Level',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 78,
  },
  {
    user_id: 12,
    name: 'Jack Wong',
    avatar: avatarImage.src,
    job_title: 'CTO',
    company: 'Tesla',
    years_of_experience: '10',
    location: 'Austin, TX',
    linkedin_profile: 'https://www.linkedin.com/in/jackwong/',
    interested_positions: { interests: [], language: null },
    skills: { interests: [], language: null },
    topics: { interests: [], language: null },
    industry: {
      id: 12,
      category: '1',
      language: 'english',
      subject_group: '3',
      subject: '3',
      profession_metadata: {
        desc: '',
        icon: '',
      },
    },
    onboarding: false,
    is_mentor: true,
    language: 'English',
    personal_statement: 'Leading innovation and scaling technology teams.',
    about: 'Driving technological strategy and execution.',
    seniority_level: 'Executive',
    expertises: {
      professions: [],
    },
    update_at: 1672531199000,
    views: 120,
  },
];

const MentorPool = () => {
  // const [searchTerm, setSearchTerm] = useState('');
  const [mentorCount, setMentorCount] = useState<number>(0);
  const [mentors, setMentors] = useState<MentorType[]>(mockMentors);
  const [filterMentors, setFilterMentors] = useState<MentorType[]>([]);

  const handleFilterChange = (filteredMentors: MentorType[]) => {
    setFilterMentors(filteredMentors);
    setMentorCount(filteredMentors.length);
  };

  const handleSearch = async (queryWords: string) => {
    console.log('search term:', queryWords);
    // setSearchTerm(queryWords);
    // const rtnList = await fetchMentors();
    // if (rtnList) {
    //   setMentors(rtnList);
    //   setFilterMentors(rtnList);
    //   setMentorCount(rtnList.length);
    // }
  };

  const handleScrollToBottom = async () => {
    // const rtnList = await fetchMentors();
    // if (rtnList) {
    //   setMentors((prevMentors) => [...prevMentors, ...rtnList]);
    //   setFilterMentors((prevMentors) => [...prevMentors, ...rtnList]);
    //   setMentorCount(rtnList.length);
    // }
  };

  useEffect(() => {
    // const rtnList = await fetchMentors();
    const rtnList = mockMentors;
    if (rtnList) {
      setMentors(rtnList);
      setFilterMentors(rtnList);
      setMentorCount(rtnList.length);
    }
  }, []);

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
                users={mentors}
                onChange={handleFilterChange}
                filterOptions={filterOptions}
              />
            </div>
          </div>
          <MentorCardList
            mentors={filterMentors}
            onScrollToBottom={handleScrollToBottom}
          />
        </div>
      </section>
    </div>
  );
};

export default MentorPool;
