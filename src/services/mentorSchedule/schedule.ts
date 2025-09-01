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
  dtstart: Date; // 後端實際多半是 ISO 字串，hook 會統一轉成 unix seconds
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

/** ========= 與 backend 對齊（保留 rrule / timezone / exdate / until / user_id） ========= */
export type UpsertTimeslotBackend = {
  id?: string | number;
  user_id?: string | number;
  dt_type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
  rrule?: string; // 一次性可給空字串或不送
};

interface SaveScheduleResponse {
  code: string;
  msg: string;
}

/** PUT /v1/mentors/:userId/schedule */
export async function saveMentorSchedule(params: {
  userId: string;
  timeslots: UpsertTimeslotBackend[];
  until?: number | null; // 若你的後端支援在 body 最外層帶 until
}): Promise<boolean> {
  console.log('hello save schedule');
  try {
    // 乾淨化 object：移除 undefined / null 欄位
    const clean = (obj: Record<string, any>) =>
      Object.fromEntries(
        Object.entries(obj).filter(
          ([, v]) =>
            v !== undefined &&
            v !== null &&
            !(Array.isArray(v) && v.length === 0)
        )
      );

    const body = clean({
      until: params.until,
      timeslots: params.timeslots.map((t) =>
        clean({
          id: t.id,
          user_id: params.userId, // 通常由 path 參數決定，可不送
          dt_type: t.dt_type,
          dtstart: t.dtstart,
          dtend: t.dtend,
          rrule: t.rrule, // 一次性可為 ''
        })
      ),
    });

    console.log('user id: ', params.userId);
    console.log('body: ', body);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${params.userId}/schedule`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    console.log(res);
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
