import { apiClient } from '@/lib/apiClient';
import { components } from '@/types/api';

export interface ScheduleRequest {
  userId: string;
  year: number;
  month: number;
}

export type TimeSlotVO = components['schemas']['TimeSlotVO'];

export interface BookedSlot {
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
}

// MentorScheduleVO does not document these fields in the OpenAPI spec;
// they are kept as optional extensions for runtime compatibility.
export type ScheduleData = components['schemas']['MentorScheduleVO'] & {
  meeting_duration_minutes?: number;
  booked_slots?: BookedSlot[];
};

interface ScheduleApiResponse {
  code: string;
  msg: string;
  data: ScheduleData;
}

export async function fetchMentorSchedule(
  param: ScheduleRequest
): Promise<ScheduleData> {
  try {
    const result = await apiClient.get<ScheduleApiResponse>(
      `/v1/mentors/${param.userId}/schedule/y/${param.year}/m/${param.month}`,
      { auth: false }
    );
    if (result.code !== '0') return {} as ScheduleData;
    return result.data;
  } catch {
    return {} as ScheduleData;
  }
}

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
