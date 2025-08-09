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

  return fetchUserById(Number(userId));
}

export async function fetchUserById(
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

// export async function updateUserProfile(
//   userData: Partial<UserType>
// ): Promise<boolean> {
//   const session = await getSession();
//   const token = session?.accessToken;
//   const userId = session?.user?.id;

//   if (!token || !userId) {
//     throw new Error('未找到授權令牌或使用者 ID。請重新登入。');
//   }

//   try {
//     const response = await fetch(
//       `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${userId}/profile`,
//       {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify(userData),
//       }
//     );

//     if (!response.ok) {
//       console.error('Failed to update profile:', response.statusText);
//       return false;
//     }

//     const result = await response.json();

//     if (result.code !== '0') {
//       console.error('API Error:', result.msg);
//       return false;
//     }

//     return true;
//   } catch (error) {
//     console.error('Update User Error:', error);
//     return false;
//   }
// }
