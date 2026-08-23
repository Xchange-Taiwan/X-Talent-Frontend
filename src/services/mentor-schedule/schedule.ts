import { apiClient } from '@/lib/apiClient';
import { components } from '@/types/api';

export interface ScheduleRequest {
  userId: string;
  year: number;
  month: number;
}

export type TimeSlotDTO = components['schemas']['TimeSlotDTO'];
export type SegmentVO = TimeSlotDTO;
export type ScheduleData = components['schemas']['MentorScheduleQueryVO'];

export async function fetchMentorSchedule(
  param: ScheduleRequest
): Promise<ScheduleData> {
  try {
    const data = await apiClient.getUnwrapped<ScheduleData>(
      `/v1/mentors/${param.userId}/schedule/y/${param.year}/m/${param.month}`,
      { auth: false }
    );
    return data ?? ({} as ScheduleData);
  } catch {
    return {} as ScheduleData;
  }
}

type CleanObject = Record<string, unknown>;

export function utcYearMonth(unixSeconds: number): {
  year: number;
  month: number;
} {
  const date = new Date(unixSeconds * 1000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

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
    timeslots: params.timeslots.map((t) => {
      const { year, month } = utcYearMonth(t.dtstart);
      return cleanOptional({
        id: t.id,
        user_id: Number(params.userId),
        dt_type: t.dt_type,
        // The schedule API requires the UTC month bucket for every slot.
        // Derive it from dtstart so callers cannot omit stale generated DTO fields.
        dt_year: year,
        dt_month: month,
        dtstart: t.dtstart,
        dtend: t.dtend,
        rrule: t.rrule,
        timezone: 'UTC',
        exdate: t.exdate,
      });
    }),
  });

  await apiClient.putUnwrapped<null>(
    `/v1/mentors/${params.userId}/schedule`,
    body
  );
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
