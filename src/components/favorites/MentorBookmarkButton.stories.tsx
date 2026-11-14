import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLayoutEffect } from 'react';

import { Toaster } from '@/components/ui/toaster';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';

import { MentorBookmarkButton, type MentorBookmarkButtonProps } from './index';

function SeededBookmarkPreview({
  initialFavorited = false,
  userId = 'test-user-id',
  ...props
}: MentorBookmarkButtonProps & {
  initialFavorited?: boolean;
  userId?: string | null;
}) {
  useLayoutEffect(() => {
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: async () => [],
      addFavoriteMentor: async () => {},
      removeFavoriteMentor: async () => {},
    });
    favoriteMentorStore.seedFavorites(
      userId,
      initialFavorited ? [props.mentorId] : []
    );
  }, [initialFavorited, props.mentorId, userId]);

  return (
    <div className="bg-background-bottom flex min-h-[140px] min-w-[240px] items-center justify-center rounded-lg p-8">
      <MentorBookmarkButton {...props} />
      <Toaster />
    </div>
  );
}

const meta: Meta<typeof SeededBookmarkPreview> = {
  title: '業務模組元件/收藏導師(Favorites)/MentorBookmarkButton',
  component: SeededBookmarkPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    mentorId: 101,
    mentorName: '陳宥廷 Austin',
    variant: 'overlay',
    tooltipSide: 'top',
    tooltipAlign: 'center',
  },
};

export default meta;
type Story = StoryObj<typeof SeededBookmarkPreview>;

export const UnfavoritedOverlay: Story = {
  args: {
    initialFavorited: false,
    variant: 'overlay',
  },
};

export const FavoritedOverlay: Story = {
  args: {
    initialFavorited: true,
    variant: 'overlay',
  },
};

export const ProfileHeaderOutline: Story = {
  args: {
    initialFavorited: false,
    variant: 'outline',
  },
};

export const ProfileHeaderOutlineFavorited: Story = {
  args: {
    initialFavorited: true,
    variant: 'outline',
  },
};

export const GuestUnauthenticated: Story = {
  parameters: {
    nextAuth: { session: null },
  },
  args: {
    userId: null,
    initialFavorited: false,
    variant: 'outline',
  },
};
