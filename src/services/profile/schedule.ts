export interface ScheduleRequest {
  userId: string;
  year: number;
  month: number;
}

export interface ScheduleTimeSlots {
  id: string;
  user_id: string;
  dt_type: 'ALLOW' | 'BLOCK';
  dt_year: string;
  dt_month: string;
  dtstart: Date;
  dtend: Date;
  timezone: string;
  rrule: string;
  exdate: [];
}

export interface ScheduleType {
  timeslots: ScheduleTimeSlots[] | [];
  next_dtstart: string;
}

interface ScheduleResponse {
  code: string;
  msg: string;
  data: ScheduleType;
}

export async function fetchMentorSchedule(
  param: ScheduleRequest
): Promise<ScheduleType> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${param.userId}/schedule/y/${param.year}/m/${param.month}`,
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

    const result: ScheduleResponse = await response.json();

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return {} as ScheduleType;
    }

    return result.data;
  } catch (error) {
    console.error('Fetch Mentors Schedule Error:', error);
    return {} as ScheduleType;
  }
}
