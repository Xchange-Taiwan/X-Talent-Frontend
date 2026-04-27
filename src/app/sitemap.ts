import type { MetadataRoute } from 'next';

import type { components } from '@/types/api';

type MentorListResponse =
  components['schemas']['ApiResponse_SearchMentorProfileListVO_'];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// Single-page fetch keeps build-time work bounded. Bump or add cursor pagination
// when public mentor count approaches this number.
const MENTOR_LIMIT = 1000;

export const revalidate = 86400;

async function fetchPublicMentorIds(): Promise<number[]> {
  if (!API_URL) return [];

  try {
    const response = await fetch(
      `${API_URL}/v1/mentors?limit=${MENTOR_LIMIT}`,
      { next: { revalidate } }
    );
    if (!response.ok) return [];

    const result = (await response.json()) as MentorListResponse;
    if (result.code !== '0') return [];

    return (result.data?.mentors ?? [])
      .map((m) => m.user_id)
      .filter((id): id is number => typeof id === 'number');
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/mentor-pool`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const mentorIds = await fetchPublicMentorIds();
  const mentorPages: MetadataRoute.Sitemap = mentorIds.map((id) => ({
    url: `${SITE_URL}/profile/${id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticPages, ...mentorPages];
}
