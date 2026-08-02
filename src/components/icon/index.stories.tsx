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

// 建立一個網格畫布來展示所有彩色圖標
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

// 2. 獨立圖標展示用的共用包裝組件 (解決重複程式碼 Code Smell)
interface SingleIconShowcaseProps {
  name: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  args: React.SVGProps<SVGSVGElement>;
}

const SingleIconShowcase: React.FC<SingleIconShowcaseProps> = ({
  name,
  Icon,
  args,
}) => {
  return (
    <div className="flex max-w-sm flex-col items-center justify-center rounded-lg border border-muted bg-card p-8 text-card-foreground shadow-sm">
      <Icon {...args} />
      <span className="mt-4 font-mono text-sm text-muted-foreground">
        {name}
      </span>
    </div>
  );
};

// 產生獨立圖標 Story 結構的輔助函式
const createIconStory = (
  name: string,
  IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>,
  displayName: string
): StoryObj<typeof IconComponent> => ({
  name: displayName,
  render: (args) => (
    <SingleIconShowcase name={name} Icon={IconComponent} args={args} />
  ),
  args: {
    width: 64,
    height: 64,
  },
});

// 3. 各個獨立品牌圖標 Stories (精簡且維護性高)
export const FacebookIcon = createIconStory(
  'FacebookColor',
  FacebookColor,
  'Facebook 品牌圖標'
);
export const GoogleIcon = createIconStory(
  'GoogleColor',
  GoogleColor,
  'Google 品牌圖標'
);
export const InstagramIcon = createIconStory(
  'InstagramColor',
  InstagramColor,
  'Instagram 品牌圖標'
);
export const LinkedinIcon = createIconStory(
  'LinkedinColor',
  LinkedinColor,
  'Linkedin 品牌圖標'
);
export const TwitterIcon = createIconStory(
  'TwitterColor',
  TwitterColor,
  'Twitter/X 品牌圖標'
);
export const WebsiteIcon = createIconStory(
  'WebsiteColor',
  WebsiteColor,
  '個人網站圖標'
);
export const YoutubeIcon = createIconStory(
  'YoutubeColor',
  YoutubeColor,
  'Youtube 品牌圖標'
);
