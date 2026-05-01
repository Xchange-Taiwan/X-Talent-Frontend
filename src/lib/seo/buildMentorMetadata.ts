import type { Metadata } from 'next';

import type { PublicMentorProfile } from './sanitizePublicProfile';

const MAX_DESCRIPTION_LENGTH = 160;

function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~]+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastBoundary = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('，'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf(', '),
    slice.lastIndexOf(' ')
  );
  const cut = lastBoundary > max * 0.6 ? lastBoundary + 1 : max;
  return slice.slice(0, cut).trimEnd() + '…';
}

function buildDescription(profile: PublicMentorProfile): string {
  const cleaned = stripMarkdown(profile.about);
  if (cleaned) return truncate(cleaned, MAX_DESCRIPTION_LENGTH);

  const headlineFragments: string[] = [];
  if (profile.jobTitle) headlineFragments.push(profile.jobTitle);
  if (profile.company) headlineFragments.push(`@ ${profile.company}`);
  const headline = headlineFragments.join(' ');

  if (profile.name && headline) {
    return truncate(
      `${profile.name}｜${headline} 查看導師資歷與預約方式`,
      MAX_DESCRIPTION_LENGTH
    );
  }

  return profile.name
    ? `查看 ${profile.name} 的導師資歷與預約方式`
    : '查看 XChange Talent Pool 導師資歷與預約方式';
}

export function buildMentorMetadata(profile: PublicMentorProfile): Metadata {
  const canonical = `/profile/${profile.userId}`;
  const description = buildDescription(profile);

  if (!profile.name) {
    return {
      title: 'XChange Talent Pool',
      description,
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  if (!profile.isMentor) {
    return {
      title: profile.name,
      description,
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const title = `${profile.name} - 導師專業背景`;
  const ogImages = profile.avatar ? [{ url: profile.avatar }] : [];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      title: profile.name,
      description,
      url: canonical,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: profile.name,
      description,
      images: ogImages.map((image) => image.url),
    },
  };
}
