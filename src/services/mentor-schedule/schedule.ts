import { apiClient, ApiError } from '@/lib/apiClient';
import { components } from '@/types/api';

export interface ScheduleRequest {
  userId: string;
  year: number;
  month: number;
}

export type SegmentVO = components['schemas']['MentorScheduleSegmentVO'];
export type ScheduleData = components['schemas']['MentorScheduleQueryVO'];

export type TimeSlotDTO = components['schemas']['TimeSlotDTO'];

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

interface SaveScheduleResponse {
  code: string;
  msg: string;
}

type CleanObject = Record<string, unknown>;

/**
 * PUT /v1/mentors/:userId/schedule
 *
 * Resolves on success, throws on failure. HTTP failures bubble up as ApiError
 * (with backend `msg` in `.message`); a non-zero response `code` is rethrown
 * as ApiError(200, msg) so callers can surface the same message regardless of
 * transport-level vs. body-level failure.
 */
export async function saveMentorSchedule(params: {
  userId: string;
  timeslots: TimeSlotDTO[];
  until?: number | null;
}): Promise<void> {
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

  const result = await apiClient.put<SaveScheduleResponse>(
    `/v1/mentors/${params.userId}/schedule`,
    body
  );
  if (result.code !== '0') {
    throw new ApiError(200, result.msg || 'Save failed', result);
  }
}

/**
 * DELETE /v1/mentors/:userId/schedule/:scheduleId
 *
 * Resolves on success, throws on failure (ApiError bubbles up from apiClient).
 */
export async function deleteMentorSchedule(params: {
  userId: string | number;
  scheduleId: string | number;
}): Promise<void> {
  await apiClient.delete(
    `/v1/mentors/${params.userId}/schedule/${params.scheduleId}`
  );
}
