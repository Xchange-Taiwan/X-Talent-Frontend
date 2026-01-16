import { getSession } from 'next-auth/react';

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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${userId}/reservations`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result: ReservationsResponse = await response.json();

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
