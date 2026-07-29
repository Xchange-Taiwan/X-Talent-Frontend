import {
  FacebookColor,
  InstagramColor,
  LinkedinColor,
  TwitterColor,
  WebsiteColor,
  YoutubeColor,
} from '@/components/icon';

export const platformLabelMap: Record<
  string,
  { label: string; icon: JSX.Element }
> = {
  linkedin: {
    label: 'LinkedIn',
    icon: <LinkedinColor className="size-5" />,
  },
  facebook: {
    label: 'Facebook',
    icon: <FacebookColor className="size-5" />,
  },
  instagram: {
    label: 'Instagram',
    icon: <InstagramColor className="size-5" />,
  },
  twitter: {
    label: 'X (formerly Twitter)',
    icon: <TwitterColor className="size-5" />,
  },
  youtube: {
    label: 'YouTube',
    icon: <YoutubeColor className="size-5" />,
  },
  website: {
    label: '個人網站',
    icon: <WebsiteColor className="size-5" />,
  },
};
