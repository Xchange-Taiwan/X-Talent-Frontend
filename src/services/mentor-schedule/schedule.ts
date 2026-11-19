import { apiClient } from '@/lib/apiClient';
import type { ScheduleUpsertSlot } from '@/lib/profile/bookingAvailability/types';
import { components } from '@/types/api';

export interface ScheduleRequest {
  userId: string;
  year: number;
  month: number;
}

export type TimeSlotDTO = components['schemas']['TimeSlotDTO'];
export type SegmentVO = TimeSlotDTO;
export type ScheduleData = components['schemas']['MentorScheduleQueryVO'];

/**
 * Input slot shape accepted by `saveMentorSchedule`. Accepts pure domain
 * `ScheduleUpsertSlot` items directly (defaulting `dt_type` to `'ALLOW'`) so
 * DTO serialization happens exclusively inside `saveMentorSchedule`.
 */
export type SaveMentorScheduleSlotInput = Omit<
  ScheduleUpsertSlot,
  'id' | 'rrule' | 'exdate'
> & {
  id?: number | null;
  dt_type?: string;
  rrule?: string | null;
  exdate?: number[];
};

/**
 * `signal` lets a caller cancel the request when the month it belongs to is
 * no longer the one being viewed. A cancelled request lands in the same
 * catch as any other failure and resolves to an empty schedule; callers that
 * need to tell cancellation apart must check the signal themselves.
 */
export async function fetchMentorSchedule(
  param: ScheduleRequest,
  signal?: AbortSignal
): Promise<ScheduleData> {
  try {
    const data = await apiClient.getUnwrapped<ScheduleData>(
      `/v1/mentors/${param.userId}/schedule/y/${param.year}/m/${param.month}`,
      { auth: false, ...(signal ? { signal } : {}) }
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
  timeslots: SaveMentorScheduleSlotInput[];
  until?: number | null;
}): Promise<void> {
  const cleanOptional = (obj: CleanObject): CleanObject =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    );

  const serializeSlotToDTO = (t: SaveMentorScheduleSlotInput): CleanObject => {
    const { year, month } = utcYearMonth(t.dtstart);
    const dto: Omit<TimeSlotDTO, 'id' | 'rrule' | 'exdate'> & {
      id?: number | null;
      rrule?: string | null;
      exdate?: number[];
    } = {
      id: t.id,
      user_id: Number(params.userId),
      dt_type: t.dt_type ?? 'ALLOW',
      // The schedule API requires the UTC month bucket for every slot.
      // Derive it from dtstart so callers never construct DTO fields.
      dt_year: year,
      dt_month: month,
      dtstart: t.dtstart,
      dtend: t.dtend,
      rrule: t.rrule,
      timezone: 'UTC',
      exdate: t.exdate,
    };
    return cleanOptional(dto);
  };

  const body = cleanOptional({
    until: params.until,
    timeslots: params.timeslots.map(serializeSlotToDTO),
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
