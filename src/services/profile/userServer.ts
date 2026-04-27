import type { components } from '@/types/api';

import type { MentorProfileVO } from './user';

type ApiResponseMentorProfileVO =
  components['schemas']['ApiResponse_MentorProfileVO_'];

const BFF_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function fetchUserByIdServer(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  if (!BFF_URL) {
    console.error('fetchUserByIdServer: NEXT_PUBLIC_API_URL is not set');
    return null;
  }

  try {
    const res = await fetch(
      `${BFF_URL}/v1/mentors/${userId}/${language}/profile`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      console.error(`fetchUserByIdServer: HTTP ${res.status}`);
      return null;
    }

    const result = (await res.json()) as ApiResponseMentorProfileVO;
    if (result.code !== '0') {
      console.error(`fetchUserByIdServer API error: ${result.msg}`);
      return null;
    }

    return result.data ?? null;
  } catch (error) {
    console.error('fetchUserByIdServer error:', error);
    return null;
  }
}
