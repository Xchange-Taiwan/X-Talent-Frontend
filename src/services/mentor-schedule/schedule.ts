import { apiClient } from '@/lib/apiClient';
import { components } from '@/types/api';

export interface ScheduleRequest {
  userId: string;
  year: number;
  month: number;
}

export type SegmentVO = components['schemas']['MentorScheduleSegmentVO'];
export type ScheduleData = components['schemas']['MentorScheduleQueryVO'];

type TimeSlotDTO = components['schemas']['TimeSlotDTO'];

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

export type UpsertTimeslotBackend = Pick<
  TimeSlotDTO,
  'dtstart' | 'dtend' | 'rrule'
> & {
  id?: number;
  dt_type: 'ALLOW';
  exdate: number[]; // nulls excluded from TimeSlotDTO.exdate
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
}): Promise<boolean> {
  const cleanOptional = (obj: CleanObject): CleanObject =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    );

  const body = cleanOptional({
    until: params.until,
    timeslots: params.timeslots.map((t) =>
      cleanOptional({
        id: t.id,
        user_id: Number(params.userId),
        dt_type: t.dt_type,
        dtstart: t.dtstart,
        dtend: t.dtend,
        rrule: t.rrule,
        timezone: 'UTC',
        exdate: t.exdate,
      })
    ),
  });

  try {
    const result = await apiClient.put<SaveScheduleResponse>(
      `/v1/mentors/${params.userId}/schedule`,
      body
    );
    if (result.code !== '0') {
      console.error(
        '[saveMentorSchedule] non-zero code:',
        result.code,
        result.msg
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[saveMentorSchedule] request failed:', err);
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
      `/v1/mentors/${params.userId}/schedule/${params.scheduleId}`
    );
    return true;
  } catch {
    return false;
  }
}
