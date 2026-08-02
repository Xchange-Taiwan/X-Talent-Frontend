import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  FacebookColor,
  GoogleColor,
  InstagramColor,
  LinkedinColor,
  TwitterColor,
  WebsiteColor,
  YoutubeColor,
} from './index';

// 建立一個畫布來展示所有彩色圖標
interface ColorIconsGalleryProps {
  size?: number | string;
  className?: string;
}

const ColorIconsGallery: React.FC<ColorIconsGalleryProps> = ({
  size = 32,
  className = '',
}) => {
  const iconsList = [
    { name: 'FacebookColor', Icon: FacebookColor },
    { name: 'GoogleColor', Icon: GoogleColor },
    { name: 'InstagramColor', Icon: InstagramColor },
    { name: 'LinkedinColor', Icon: LinkedinColor },
    { name: 'TwitterColor', Icon: TwitterColor },
    { name: 'WebsiteColor', Icon: WebsiteColor },
    { name: 'YoutubeColor', Icon: YoutubeColor },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {iconsList.map(({ name, Icon }) => (
        <div
          key={name}
          className="flex flex-col items-center justify-center rounded-lg border border-muted bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="mb-4 flex size-16 items-center justify-center">
            <Icon width={size} height={size} className={className} />
          </div>
          <span className="select-all font-mono text-xs text-muted-foreground">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
};

const meta: Meta<typeof ColorIconsGallery> = {
  title: '基礎/原子元件/Icon/ColorIcons',
  component: ColorIconsGallery,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: [16, 24, 32, 48, 64, 80, 96],
      description: '圖標尺寸大小 (Size of the icons in pixels)',
    },
    className: {
      control: 'text',
      description: '額外套用的 CSS 類名 (Additional wrapper CSS classes)',
    },
  },
  args: {
    size: 48,
    className: '',
  },
};

export default meta;

// 1. Showcase Gallery Story
export const Gallery: StoryObj<typeof ColorIconsGallery> = {
  name: '所有彩色圖標 (All Color Icons)',
  args: {
    size: 48,
    className: '',
  },
};

// 2. Individual Icon Stories with control support
export const FacebookIcon: StoryObj<typeof FacebookColor> = {
  name: 'Facebook 品牌圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <FacebookColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        FacebookColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};

export const GoogleIcon: StoryObj<typeof GoogleColor> = {
  name: 'Google 品牌圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <GoogleColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        GoogleColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};

export const InstagramIcon: StoryObj<typeof InstagramColor> = {
  name: 'Instagram 品牌圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <InstagramColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        InstagramColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};

export const LinkedinIcon: StoryObj<typeof LinkedinColor> = {
  name: 'Linkedin 品牌圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <LinkedinColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        LinkedinColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};

export const TwitterIcon: StoryObj<typeof TwitterColor> = {
  name: 'Twitter/X 品牌圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <TwitterColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        TwitterColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};

export const WebsiteIcon: StoryObj<typeof WebsiteColor> = {
  name: '個人網站圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <WebsiteColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        WebsiteColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};

export const YoutubeIcon: StoryObj<typeof YoutubeColor> = {
  name: 'Youtube 品牌圖標',
  render: (args) => (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border p-8">
      <YoutubeColor {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        YoutubeColor
      </span>
    </div>
  ),
  args: {
    width: 64,
    height: 64,
  },
};
