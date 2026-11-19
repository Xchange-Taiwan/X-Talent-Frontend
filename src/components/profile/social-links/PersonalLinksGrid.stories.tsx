import type { Meta, StoryObj } from '@storybook/nextjs';

import { PersonalLinksGrid } from './PersonalLinksGrid';
import { resolveDisplaySocialLinks } from './platformLabelMap';

const meta: Meta<typeof PersonalLinksGrid> = {
  title: '業務模組元件/個人檔案(Profile)/View/PersonalLinksGrid',
  component: PersonalLinksGrid,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PersonalLinksGrid>;

export const MixedAvailableAndUnavailable: Story = {
  args: {
    userId: '7482008160728084',
    links: resolveDisplaySocialLinks([
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/zahra' },
      { platform: 'github', url: 'https://github.com/zahra' },
      { platform: 'website', url: 'https://zahra.design' },
    ]),
  },
};

export const AllAvailable: Story = {
  args: {
    userId: '7482008160728087',
    links: resolveDisplaySocialLinks([
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/zahra' },
      { platform: 'facebook', url: 'https://www.facebook.com/zahra' },
      { platform: 'instagram', url: 'https://www.instagram.com/zahra' },
      { platform: 'twitter', url: 'https://x.com/zahra' },
      { platform: 'youtube', url: 'https://www.youtube.com/@zahra' },
      { platform: 'github', url: 'https://github.com/zahra' },
      { platform: 'website', url: 'https://zahra.design' },
    ]),
  },
};

export const AllEmpty: Story = {
  args: {
    userId: '7482008160728084',
    links: [],
  },
};
