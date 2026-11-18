import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';

import { resolveDisplaySocialLinks } from '@/components/profile/social-links/platformLabelMap';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import {
  buildMenteeDirectionReadGroups,
  resolveMenteeIndustryHashtag,
} from '@/lib/profile/menteeDirectionView';

import { MenteeProfileContent } from './MenteeProfileContent';

const meta: Meta<typeof MenteeProfileContent> = {
  title: '業務模組元件/個人檔案(Profile)/MenteeProfileContent',
  component: MenteeProfileContent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MenteeProfileContent>;

const sampleMentee: UserType = {
  user_id: 202,
  name: '陳小華',
  avatar: '',
  job_title: 'Product Designer',
  company: 'Flow Studio',
  is_mentor: false,
  about:
    '我是一名正在累積產品設計經驗的設計師，喜歡透過研究理解使用者的需求。\n\n希望與不同領域的夥伴交流，精進作品集敘事、設計系統與跨部門合作的能力。',
  years_of_experience: '1~3 年',
  location: '臺灣',
  industry: '設計及創意相關業',
  want_position: [
    { subject_group: 'uiux', subject: '產品設計／UIUX' },
    { subject_group: 'fe', subject: '前端工程' },
  ],
  want_skill: [
    { subject_group: 'ux_research', subject: 'UX Research' },
    { subject_group: 'design_system', subject: '設計系統' },
    { subject_group: 'react', subject: 'React' },
  ],
  want_topic: [
    { subject_group: 'portfolio', subject: '作品集檢視' },
    { subject_group: 'career', subject: '職涯規劃' },
    { subject_group: 'interview', subject: '模擬面試' },
  ],
  have_skill: [],
  have_topic: [],
  workExperiences: [
    {
      job: 'Product Designer',
      company: 'Flow Studio',
      job_period_start: '2024',
      job_period_end: '至今',
      industry: '設計及創意相關業',
      job_location: '臺灣',
      description: '參與產品介面設計與使用者研究，和工程團隊一起改善使用流程。',
      is_primary: true,
    },
  ],
  educations: [
    {
      subject: '視覺傳達設計學系',
      school: '國立雲林科技大學',
      education_period_start: '2020',
      education_period_end: '2024',
    },
  ],
  personalLinks: [
    { platform: 'linkedin', url: 'https://www.linkedin.com/in/example' },
    { platform: 'github', url: 'https://github.com/example' },
    { platform: 'website', url: 'https://example.com' },
  ],
};

export const Filled: Story = {
  render: () => {
    const [activeDirection, setActiveDirection] = useState<string>('uiux');
    const groups = buildMenteeDirectionReadGroups({
      positions: sampleMentee.want_position,
      skills: sampleMentee.want_skill,
      topics: sampleMentee.want_topic,
      storedMap: {
        uiux: {
          skills: ['ux_research', 'design_system'],
          topics: ['portfolio', 'career'],
        },
        fe: {
          skills: ['react'],
          topics: ['interview'],
        },
      },
    });

    return (
      <div className="max-w-[720px] p-6">
        <MenteeProfileContent
          userData={sampleMentee}
          isEmpty={false}
          industryHashtag={resolveMenteeIndustryHashtag(sampleMentee)}
          directionGroups={groups}
          activeDirection={activeDirection}
          onSelectDirection={setActiveDirection}
          personalLinks={resolveDisplaySocialLinks(sampleMentee.personalLinks)}
        />
      </div>
    );
  },
};

export const Empty: Story = {
  args: {
    userData: {
      ...sampleMentee,
      about: '',
      industry: '',
      want_position: [],
      want_skill: [],
      want_topic: [],
      workExperiences: [],
      educations: [],
      personalLinks: [],
    },
    isEmpty: true,
    industryHashtag: null,
    directionGroups: [],
    activeDirection: null,
    onSelectDirection: () => {},
    personalLinks: [],
  },
};
