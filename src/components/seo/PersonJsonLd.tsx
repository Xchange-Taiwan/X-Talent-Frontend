import type { PublicMentorProfile } from '@/lib/seo/sanitizePublicProfile';

interface Props {
  profile: PublicMentorProfile;
  siteUrl: string;
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function PersonJsonLd({ profile, siteUrl }: Props): JSX.Element | null {
  if (!profile.isMentor || !profile.name) return null;

  const absoluteUrl = `${siteUrl.replace(/\/$/, '')}/profile/${profile.userId}`;

  const knowsAbout = Array.from(
    new Set([...profile.expertises, ...profile.topics])
  ).filter(Boolean);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    url: absoluteUrl,
  };

  if (profile.avatar) jsonLd.image = profile.avatar;
  if (profile.jobTitle) jsonLd.jobTitle = profile.jobTitle;
  if (profile.company) {
    jsonLd.worksFor = {
      '@type': 'Organization',
      name: profile.company,
    };
  }
  if (knowsAbout.length > 0) jsonLd.knowsAbout = knowsAbout;
  if (profile.personalLinks.length > 0) {
    jsonLd.sameAs = profile.personalLinks.map((link) => link.url);
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeStringify(jsonLd) }}
    />
  );
}
