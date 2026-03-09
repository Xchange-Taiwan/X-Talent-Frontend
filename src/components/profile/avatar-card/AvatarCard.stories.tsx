import type { Meta, StoryFn } from '@storybook/react';

import { AvatarCard } from './AvatarCard';

export default {
  title: 'Profile/AvatarCard',
  component: AvatarCard,
  parameters: {
    /**
     * The layout parameter controls the padding and background of the preview.
     * @see https://storybook.js.org/docs/configure/story-layout#global-layout
     */
    layout: 'padded',
    /**
     * The backgrounds parameter controls the background of the preview.
     * @see https://storybook.js.org/docs/essentials/backgrounds#configuration
     */
    backgrounds: {
      default: 'light',
    },
  },
  /**
   * The args parameter controls the props that are passed to the component.
   */
  args: {
    name: 'Martin Lin',
    avatarImgUrl: 'https://avatars.githubusercontent.com/u/34314614',
    jobTitle: 'Software Engineer',
    companyName: 'Hahow',
    linkedinUrl: 'https://www.linkedin.com/in/cheng-yi-lin/',
  },
} as Meta<typeof AvatarCard>;

const Template: StoryFn<typeof AvatarCard> = (args) => <AvatarCard {...args} />;

export const Default = Template.bind({});
