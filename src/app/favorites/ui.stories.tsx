import type { Meta, StoryObj } from '@storybook/nextjs';
import { type ReactNode, useLayoutEffect } from 'react';

import { mockMentors } from '@/components/mentor-pool/__mocks__/mentors.mock';
import { Toaster } from '@/components/ui/toaster';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

import FavoritesPageUI from './ui';

function FavoritesStoreSeedBoundary({
  mentors,
  children,
}: {
  mentors: MentorType[];
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: async () => mentors,
      addFavoriteMentor: async () => {},
      removeFavoriteMentor: async () => {},
    });
    favoriteMentorStore.seedFavorites('test-user-id', mentors);
  }, [mentors]);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

const meta: Meta<typeof FavoritesPageUI> = {
  title: '業務模組元件/收藏導師(Favorites)/FavoritesPageUI',
  component: FavoritesPageUI,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story, context) => (
      <FavoritesStoreSeedBoundary mentors={context.args.mentors ?? []}>
        <Story />
      </FavoritesStoreSeedBoundary>
    ),
  ],
  args: {
    mentors: mockMentors.slice(0, 3),
    mentorCount: 3,
    listStatus: 'success',
  },
};

export default meta;
type Story = StoryObj<typeof FavoritesPageUI>;

export const PopulatedList: Story = {
  args: {
    mentors: mockMentors.slice(0, 3),
    mentorCount: 3,
    listStatus: 'success',
  },
};

export const SingleMentor: Story = {
  args: {
    mentors: mockMentors.slice(0, 1),
    mentorCount: 1,
    listStatus: 'success',
  },
};

export const EmptyState: Story = {
  args: {
    mentors: [],
    mentorCount: 0,
    listStatus: 'empty',
  },
};

export const LoadingState: Story = {
  args: {
    mentors: [],
    mentorCount: 0,
    listStatus: 'loading',
  },
};
