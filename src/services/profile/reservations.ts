import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';

export interface ExperienceType {
  [key: string]: unknown;
}

export interface ReservationType {
  user_id: number;
  reservation_id?: number;
}

interface ReservationsResponse {
  code: string;
  msg: string;
  data: undefined;
}

export async function fetchReservations(): Promise<ReservationType | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  return fetchReservationsByUserId(Number(userId));
}

export async function fetchReservationsByUserId(
  userId: number
): Promise<ReservationType | null> {
  try {
    const result = await apiClient.get<ReservationsResponse>(
      `/v1/users/${userId}/reservations`,
      { auth: false }
    );

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return null;
    }

    return result.data ?? null;
  } catch (error) {
    console.error('Fetch User Error:', error);
    return null;
  }
}
