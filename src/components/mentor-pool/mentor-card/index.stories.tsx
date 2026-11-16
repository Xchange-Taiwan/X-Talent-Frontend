import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLayoutEffect } from 'react';

import { favoriteMentorsReadModel } from '@/lib/favorites';

import { mockMentors } from '../__mocks__/mentors.mock';
import { MentorCard } from './index';

const STORY_LABEL_MAP = new Map<string, string>([
  ['portfolio_review', '作品集健檢'],
  ['career_planning', '職涯規劃'],
  ['product_design', '產品設計'],
  ['typescript', 'TypeScript'],
]);

const meta: Meta<typeof MentorCard> = {
  title: '業務模組元件/導師池(MentorPool)/MentorCard',
  component: MentorCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '導師池與我的收藏共用卡片元件，直接接收 `mentor: MentorType` 並透過 `projectMentorCard` 投影標籤、評分、已完成場次與預設頭像，外層連結內建 `mentor_card_click` 宣告式埋點並附帶數值字串 `mentor_id`。',
      },
    },
  },
  args: {
    mentor: mockMentors[0],
    priority: false,
  },
};

export default meta;
type Story = StoryObj<typeof MentorCard>;

export const Default: Story = {
  args: {
    mentor: mockMentors[0],
  },
};

export const FrontendEngineer: Story = {
  args: {
    mentor: mockMentors[1],
  },
};

export const StaffProductManager: Story = {
  args: {
    mentor: mockMentors[2],
  },
};

export const NoRatingsOrSessions: Story = {
  args: {
    mentor: {
      ...mockMentors[3],
      stats: {
        completed_meeting_count: 0,
        rating_count: 0,
        rating_average: null,
      },
    },
  },
};

export const LongNameWithRating: Story = {
  args: {
    mentor: {
      ...mockMentors[0],
      name: '張哲瑋 Christopher Alexander Chang-Williams',
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      stats: {
        completed_meeting_count: 12,
        rating_count: 8,
        rating_average: 9.8,
      },
    },
  },
};

export const ShortBioWithoutRole: Story = {
  args: {
    mentor: {
      ...mockMentors[0],
      job_title: '',
      company: '',
      about: '簡短的一行自介。',
      stats: null,
    },
  },
};

export const CodeMappedWithPrioritizedSkill: Story = {
  args: {
    mentor: {
      ...mockMentors[0],
      have_topic: ['portfolio_review', 'career_planning'],
      have_skill: ['product_design', 'typescript'],
    },
    labelMap: STORY_LABEL_MAP,
    prioritizedCodes: new Set(['typescript']),
  },
};

export const FallbackAvatarWhenEmpty: Story = {
  args: {
    mentor: {
      ...mockMentors[0],
      avatar: '',
      updated_at: null,
    },
    feature: 'favorites',
    analyticsLocation: 'favorites_list',
  },
};

function SeededBookmarkedCardStory(
  props: React.ComponentProps<typeof MentorCard>
) {
  useLayoutEffect(() => {
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: async () => [],
      addFavoriteMentor: async () => {},
      removeFavoriteMentor: async () => {},
    });
    favoriteMentorsReadModel.seed('test-user-id', [props.mentor]);
  }, [props.mentor]);

  return <MentorCard {...props} />;
}

export const Bookmarked: Story = {
  args: {
    mentor: mockMentors[0],
  },
  render: (args) => <SeededBookmarkedCardStory {...args} />,
};
