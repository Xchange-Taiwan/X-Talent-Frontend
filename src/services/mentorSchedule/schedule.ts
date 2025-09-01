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
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${param.userId}/schedule/y/${param.year}/m/${param.month}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const result: ScheduleResponse = await res.json();
    if (result.code !== '0') return {} as ScheduleType;
    return result.data;
  } catch {
    return {} as ScheduleType;
  }
}

/** 與 backend 對齊 */
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
        user_id: params.userId,
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
    if (!res.ok) return false;
    const result: SaveScheduleResponse = await res.json();
    return result.code === '0';
  } catch {
    return false;
  }
}

/** DELETE /v1/mentors/:userId/schedule/:scheduleId */
export async function deleteMentorSchedule(params: {
  userId: string | number;
  scheduleId: string | number;
}): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${params.userId}/schedule/${params.scheduleId}`,
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
    );
    if (res.status === 204) return true;
    if (!res.ok) return false;

    // 若有統一回傳格式就檢查；沒有就直接當成功
    try {
      const json: SaveScheduleResponse = await res.json();
      return !json.code || json.code === '0';
    } catch {
      return true;
    }
  } catch {
    return false;
  }
}
