import type { Meta, StoryObj } from '@storybook/nextjs';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

import { ProfileBanner } from '@/components/profile/profile-banner';
import { toWireExperiences } from '@/lib/profile/experienceCodec';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { MenteeInPlaceEditor } from './MenteeInPlaceEditor';

const mockCatalog: TagCatalogsByBucket = {
  industry: [
    { subject_group: 'TECH', subject: '科技 / 軟體 / 半導體' },
    { subject_group: 'FIN', subject: '金融 / 保險' },
  ],
  want_position: [
    {
      subject_group: 'software_dev',
      subject: '軟體開發',
      language: 'zh_TW',
      leaves: [
        {
          tag_id: 1,
          subject_group: 'frontend_engineer',
          subject: '前端工程師',
          language: 'zh_TW',
        },
        {
          tag_id: 2,
          subject_group: 'backend_engineer',
          subject: '後端工程師',
          language: 'zh_TW',
        },
      ],
    },
  ],
  want_skill: [
    {
      subject_group: 'software_dev',
      subject: '軟體開發',
      language: 'zh_TW',
      leaves: [
        {
          tag_id: 11,
          subject_group: 'react',
          subject: 'React',
          language: 'zh_TW',
        },
        {
          tag_id: 12,
          subject_group: 'typescript',
          subject: 'TypeScript',
          language: 'zh_TW',
        },
        { tag_id: 13, subject_group: 'go', subject: 'Go', language: 'zh_TW' },
      ],
    },
  ],
  want_topic: [
    {
      subject_group: 'career_skill_dev',
      subject: '求職技能發展',
      language: 'zh_TW',
      leaves: [
        {
          tag_id: 21,
          subject_group: 'portfolio_guidance',
          subject: '求職作品指導',
          language: 'zh_TW',
        },
        {
          tag_id: 22,
          subject_group: 'interview_skills',
          subject: '面試說話技巧',
          language: 'zh_TW',
        },
      ],
    },
  ],
  have_skill: [],
  have_topic: [],
};

const mockMenteeDto: MentorProfileVO = {
  user_id: 202,
  name: '林小英',
  avatar: '/avatars/default_1.webp',
  job_title: 'UI/UX 設計師',
  company: '新創科技',
  years_of_experience: '3_5',
  location: 'TWN',
  industry: { subject_group: 'TECH', subject: '科技 / 軟體 / 半導體' },
  onboarding: true,
  is_mentor: false,
  language: 'zh_TW',
  personal_statement: '',
  about:
    '3 年 UI/UX 設計經驗，正在準備轉職前端工程師，想多了解前端團隊的工作方式與面試準備。',
  seniority_level: 'INTERMEDIATE',
  want_position: ['frontend_engineer', 'backend_engineer'],
  want_skill: ['react', 'typescript'],
  want_topic: ['portfolio_guidance', 'interview_skills'],
  have_skill: [],
  have_topic: [],
  experiences: toWireExperiences([
    {
      category: 'WORK',
      order: 1,
      mentor_experiences_metadata: {
        data: [
          {
            job: 'UI/UX 設計師',
            company: '新創科技',
            job_period_start: '2022',
            job_period_end: 'now',
            industry: 'TECH',
            job_location: 'TWN',
            description: '負責產品介面設計與設計系統維護。',
            is_primary: true,
          },
        ],
      },
    },
    {
      category: 'EDUCATION',
      order: 2,
      mentor_experiences_metadata: {
        data: [
          {
            school: '國立臺灣科技大學',
            subject: '設計系',
            education_period_start: '2015',
            education_period_end: '2019',
          },
        ],
      },
    },
    {
      category: 'LINK',
      order: 3,
      mentor_experiences_metadata: {
        data: [
          {
            platform: 'linkedin',
            url: 'https://www.linkedin.com/in/xiaoying-lin',
          },
          { platform: 'github', url: 'https://github.com/xiaoying-lin' },
        ],
      },
    },
  ]),
};

const meta: Meta<typeof MenteeInPlaceEditor> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/MenteeInPlaceEditor',
  component: MenteeInPlaceEditor,
  tags: ['autodocs'],
  decorators: [
    (StoryComp) => (
      <SessionProvider
        session={{
          expires: '2099-01-01T00:00:00.000Z',
          user: {
            id: '202',
            name: '林小英',
            avatar: '/avatars/default_1.webp',
            isMentor: false,
            onBoarding: true,
          },
        }}
      >
        <div>
          <ProfileBanner />
          <div className="container mb-20 max-w-screen-lg xl:max-w-screen-xl">
            <StoryComp />
          </div>
        </div>
      </SessionProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof MenteeInPlaceEditor>;

export const Default: Story = {
  name: 'Mentee 個人頁原地編輯模式 (B-2)',
  args: {
    pageUserId: '202',
    initialUserDto: mockMenteeDto,
    initialTagCatalog: mockCatalog,
    onExitEdit: () => {},
  },
};
