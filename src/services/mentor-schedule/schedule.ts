import { apiClient } from '@/lib/apiClient';

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

export interface BookedSlot {
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
}

export interface ScheduleType {
  timeslots: ScheduleTimeSlots[] | [];
  meeting_duration_minutes?: number;
  booked_slots?: BookedSlot[];
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
    const result = await apiClient.get<ScheduleResponse>(
      `/v1/mentors/${param.userId}/schedule/y/${param.year}/m/${param.month}`,
      { auth: false }
    );
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

type CleanObject = Record<string, unknown>;

/** PUT /v1/mentors/:userId/schedule */
export async function saveMentorSchedule(params: {
  userId: string;
  timeslots: UpsertTimeslotBackend[];
  until?: number | null;
  meetingDurationMinutes?: number;
  debug?: boolean;
}): Promise<boolean> {
  const clean = (obj: CleanObject): CleanObject =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([, v]) =>
          v !== undefined &&
          v !== null &&
          v !== '' &&
          !(Array.isArray(v) && v.length === 0)
      )
    );

  const body = clean({
    until: params.until,
    meeting_duration_minutes: params.meetingDurationMinutes,
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

  if (params.debug) {
    console.log(
      '[saveMentorSchedule] PUT body:',
      JSON.stringify(body, null, 2)
    );
  }

  try {
    const result = await apiClient.put<SaveScheduleResponse>(
      `/v1/mentors/${params.userId}/schedule`,
      body,
      { auth: false }
    );
    if (params.debug) {
      console.log('[saveMentorSchedule] response:', result);
    }
    if (result.code !== '0') {
      if (params.debug) {
        console.error(
          '[saveMentorSchedule] non-zero code:',
          result.code,
          result.msg
        );
      }
      return false;
    }
    return true;
  } catch (err) {
    if (params.debug) {
      console.error('[saveMentorSchedule] request failed:', err);
    }
    return false;
  }
}

/** DELETE /v1/mentors/:userId/schedule/:scheduleId */
export async function deleteMentorSchedule(params: {
  userId: string | number;
  scheduleId: string | number;
}): Promise<boolean> {
  try {
    await apiClient.delete(
      `/v1/mentors/${params.userId}/schedule/${params.scheduleId}`,
      { auth: false }
    );
    return true;
  } catch {
    return false;
  }
}
