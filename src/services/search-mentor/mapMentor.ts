import avatarImage from '@/assets/default-avatar.png';
import { normalizeMentorStats } from '@/lib/mentor/mentorStats';
import type {
  MentorListWireResponse,
  MentorPage,
  MentorStats,
  MentorType,
  RawMentor,
} from '@/types/mentor';

export type { MentorListWireResponse, MentorStats, RawMentor };

function readCodes(codes: ReadonlyArray<string> | null | undefined): string[] {
  if (!codes) return [];
  return codes.filter((c): c is string => Boolean(c));
}

export function mapMentorStats(raw: RawMentor): MentorStats | null {
  return normalizeMentorStats(raw);
}

export function mapMentor(raw: RawMentor): MentorType {
  // Search emits industry as a flat subject_group string (OpenSearch keyword
  // mapping); the OpenAPI generator types it as `Record<string, never>`
  // because BFF inherits from MentorProfileVO whose industry is a Dict on
  // the User-service GET response. The runtime value is a string here.
  const industry = raw.industry as unknown as string | null | undefined;
  const rawUpdatedAt = raw.updated_at;
  const updatedAt =
    rawUpdatedAt === null || rawUpdatedAt === undefined || rawUpdatedAt === ''
      ? null
      : String(rawUpdatedAt);

  const mapped: MentorType = {
    user_id: raw.user_id,
    name: raw.name ?? '',
    avatar: raw.avatar ?? '',
    job_title: raw.job_title ?? '',
    company: raw.company ?? '',
    years_of_experience: raw.years_of_experience ?? '',
    location: raw.location ?? '',
    personal_statement: raw.personal_statement ?? '',
    about: raw.about ?? '',
    seniority_level: raw.seniority_level ?? '',
    industry: industry ?? null,
    want_position: readCodes(raw.want_position),
    want_skill: readCodes(raw.want_skill),
    want_topic: readCodes(raw.want_topic),
    have_skill: readCodes(raw.have_skill),
    have_topic: readCodes(raw.have_topic),
    updated_at: updatedAt,
    stats: mapMentorStats(raw),
  };

  return resolveMentorAvatar(mapped);
}

// Cache-busts the avatar URL by updated_at so a re-uploaded photo isn't
// served stale; shared by SSR and client fetches so both render identically.
export function resolveMentorAvatar(mentor: MentorType): MentorType {
  return {
    ...mentor,
    avatar:
      typeof mentor.avatar === 'string' && mentor.avatar
        ? `${mentor.avatar}${
            mentor.updated_at
              ? `?cb=${encodeURIComponent(mentor.updated_at)}`
              : ''
          }`
        : avatarImage,
  };
}

export function mapMentorPage(
  data?: MentorListWireResponse | null
): MentorPage {
  return {
    mentors: (data?.mentors ?? []).map((mentor) => mapMentor(mentor)),
    nextCursor: data?.next_cursor || null,
  };
}
