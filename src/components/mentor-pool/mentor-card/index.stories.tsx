import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockMentors } from '../__mocks__/mentors.mock';
import { buildMentorCardTags } from '../mentor-card-list';
import { MentorCard } from './index';

const meta: Meta<typeof MentorCard> = {
  title: '業務模組元件/導師池(MentorPool)/MentorCard',
  component: MentorCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '導師池列表卡片，外層連結內建 `mentor_card_click` 宣告式埋點並附帶數值字串 `mentor_id`（嚴格不傳送導師真實姓名）。',
      },
    },
  },
  args: {
    id: mockMentors[0].user_id,
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: mockMentors[0].name,
    job_title: mockMentors[0].job_title,
    company: mockMentors[0].company,
    about: mockMentors[0].about,
    haveTopicLabels: buildMentorCardTags(mockMentors[0]),
    ratingAverage: mockMentors[0].stats?.rating_average ?? null,
    completedMeetingCount:
      mockMentors[0].stats?.completed_meeting_count ?? null,
    priority: false,
  },
  argTypes: {
    years: {
      control: 'select',
      options: [
        'BELOW_ONE_YEAR',
        'ONE_TO_THREE',
        'THREE_TO_FIVE',
        'FIVE_TO_TEN',
        'OVER_TEN_YEAR',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MentorCard>;

export const Default: Story = {
  args: {
    id: mockMentors[0].user_id,
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: mockMentors[0].name,
    job_title: mockMentors[0].job_title,
    company: mockMentors[0].company,
    about: mockMentors[0].about,
    haveTopicLabels: buildMentorCardTags(mockMentors[0]),
    ratingAverage: 9.8,
    completedMeetingCount: 18,
  },
};

export const FrontendEngineer: Story = {
  args: {
    id: mockMentors[1].user_id,
    avatar: mockMentors[1].avatar,
    years: mockMentors[1].years_of_experience,
    name: mockMentors[1].name,
    job_title: mockMentors[1].job_title,
    company: mockMentors[1].company,
    about: mockMentors[1].about,
    haveTopicLabels: buildMentorCardTags(mockMentors[1]),
    ratingAverage: 9.6,
    completedMeetingCount: 12,
  },
};

export const StaffProductManager: Story = {
  args: {
    id: mockMentors[2].user_id,
    avatar: mockMentors[2].avatar,
    years: mockMentors[2].years_of_experience,
    name: mockMentors[2].name,
    job_title: mockMentors[2].job_title,
    company: mockMentors[2].company,
    about: mockMentors[2].about,
    haveTopicLabels: buildMentorCardTags(mockMentors[2]),
    ratingAverage: null,
    completedMeetingCount: 5,
  },
};

export const NoRatingsOrSessions: Story = {
  args: {
    id: mockMentors[3].user_id,
    avatar: mockMentors[3].avatar,
    years: mockMentors[3].years_of_experience,
    name: mockMentors[3].name,
    job_title: mockMentors[3].job_title,
    company: mockMentors[3].company,
    about: mockMentors[3].about,
    haveTopicLabels: buildMentorCardTags(mockMentors[3]),
    ratingAverage: null,
    completedMeetingCount: 0,
  },
};

export const LongNameWithRating: Story = {
  args: {
    id: mockMentors[0].user_id,
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: '張哲瑋 Christopher Alexander Chang-Williams',
    job_title: 'Senior UX Designer',
    company: 'CreativeUX Design Studio',
    about: mockMentors[0].about,
    haveTopicLabels: buildMentorCardTags(mockMentors[0]),
    ratingAverage: 9.8,
    completedMeetingCount: 12,
  },
};

export const ShortBioWithoutRole: Story = {
  args: {
    id: mockMentors[0].user_id,
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: mockMentors[0].name,
    job_title: '',
    company: '',
    about: '簡短的一行自介。',
    haveTopicLabels: buildMentorCardTags(mockMentors[0]),
  },
};
