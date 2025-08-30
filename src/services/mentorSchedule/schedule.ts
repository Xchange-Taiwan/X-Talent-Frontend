// schedule.ts
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
  dtstart: Date; // 注意：實際回應多半是 ISO 字串，下面轉換會處理
  dtend: Date; // 同上
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
        headers: { 'Content-Type': 'application/json' },
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

/** ========= 新增：儲存 API（依你的後端調整路由/方法） ========= */
export type UpsertTimeslot = {
  id?: string | number;
  dt_type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
};

interface SaveScheduleResponse {
  code: string;
  msg: string;
}

export async function saveMentorSchedule(params: {
  userId: string;
  timeslots: UpsertTimeslot[];
}): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${params.userId}/schedule`,
      {
        method: 'PUT', // 若你的後端是 POST/PATCH，請改這裡
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeslots: params.timeslots }),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result: SaveScheduleResponse = await res.json();
    if (result.code !== '0') {
      console.error(`Save API Error: ${result.msg}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Save Mentors Schedule Error:', e);
    return false;
  }
}
