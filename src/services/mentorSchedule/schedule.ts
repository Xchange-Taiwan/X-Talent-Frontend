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
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
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

/** ========= 與 backend 對齊 ========= */
export type UpsertTimeslotBackend = {
  id?: string | number;
  user_id?: string | number;
  dt_type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
  rrule?: string;
};

interface SaveScheduleResponse {
  code: string;
  msg: string;
}

/** PUT /v1/mentors/:userId/schedule */
export async function saveMentorSchedule(params: {
  userId: string;
  timeslots: UpsertTimeslotBackend[];
  until?: number | null;
}): Promise<boolean> {
  const clean = (obj: Record<string, any>) =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([, v]) =>
          v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)
      )
    );

  const body = clean({
    until: params.until,
    timeslots: params.timeslots.map((t) =>
      clean({
        id: t.id,
        user_id: params.userId, // 後端有時會要求
        dt_type: t.dt_type,
        dtstart: t.dtstart,
        dtend: t.dtend,
        rrule: t.rrule,
      })
    ),
  });

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${params.userId}/schedule`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      let errText = '';
      try {
        errText = await res.text();
      } catch {}
      console.error('[MentorSchedule] PUT http error', {
        status: res.status,
        response: errText,
      });
      throw new Error(`HTTP ${res.status}`);
    }
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

/** DELETE /v1/mentors/:userId/schedule/:scheduleId */
export async function deleteMentorSchedule(params: {
  userId: string | number;
  scheduleId: string | number;
}): Promise<boolean> {
  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${params.userId}/schedule/${params.scheduleId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    // 有些後端回 204 無 body
    if (res.status === 204) return true;

    if (!res.ok) {
      let errText = '';
      try {
        errText = await res.text();
      } catch {}
      console.error('[MentorSchedule] DELETE http error', {
        status: res.status,
        response: errText,
      });
      return false;
    }

    // 若有統一回傳格式
    try {
      const json: SaveScheduleResponse = await res.json();
      if (json.code && json.code !== '0') {
        console.error('[MentorSchedule] DELETE api error', json);
        return false;
      }
    } catch {
      // 沒有 body 視為成功
    }
    return true;
  } catch (e) {
    console.error('Delete Mentor Schedule Error:', e);
    return false;
  }
}
