import Image from 'next/image';

export const platformLabelMap: Record<
  string,
  { label: string; icon: JSX.Element }
> = {
  linkedin: {
    label: 'LinkedIn',
    icon: (
      <Image
        src="/profile/edit/linkedin-logo.svg"
        alt="LinkedIn"
        width={20}
        height={20}
      />
    ),
  },
  facebook: {
    label: 'Facebook',
    icon: (
      <Image
        src="/profile/edit/facebook-logo.svg"
        alt="Facebook"
        width={20}
        height={20}
      />
    ),
  },
  instagram: {
    label: 'Instagram',
    icon: (
      <Image
        src="/profile/edit/instagram-logo.svg"
        alt="Instagram"
        width={20}
        height={20}
      />
    ),
  },
  twitter: {
    label: 'X (formerly Twitter)',
    icon: (
      <Image
        src="/profile/edit/twitter-logo.svg"
        alt="Twitter"
        width={20}
        height={20}
      />
    ),
  },
  youtube: {
    label: 'YouTube',
    icon: (
      <Image
        src="/profile/edit/youtube-logo.svg"
        alt="YouTube"
        width={20}
        height={20}
      />
    ),
  },
  website: {
    label: '個人網站',
    icon: (
      <Image
        src="/profile/edit/website-logo.svg"
        alt="Website"
        width={20}
        height={20}
      />
    ),
  },
};
