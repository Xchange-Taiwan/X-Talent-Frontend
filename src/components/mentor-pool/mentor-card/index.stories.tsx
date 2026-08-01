import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockMentors } from '../__mocks__/mentors.mock';
import { MentorCard } from './index';

const meta: Meta<typeof MentorCard> = {
  title: '業務模組元件/導師池(MentorPool)/MentorCard',
  component: MentorCard,
  tags: ['autodocs'],
  args: {
    id: mockMentors[0].user_id,
    avatar: mockMentors[0].avatar,
    years: mockMentors[0].years_of_experience,
    name: mockMentors[0].name,
    job_title: mockMentors[0].job_title,
    company: mockMentors[0].company,
    about: mockMentors[0].about,
    haveTopicLabels: mockMentors[0].have_topic,
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
    haveTopicLabels: mockMentors[0].have_topic,
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
    haveTopicLabels: mockMentors[1].have_topic,
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
    haveTopicLabels: mockMentors[2].have_topic,
  },
};
