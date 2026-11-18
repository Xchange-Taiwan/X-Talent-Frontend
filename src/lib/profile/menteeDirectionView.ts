import type { TagDisplay, UserType } from '@/types/user';

export interface StoredDirectionBucket {
  skills: string[];
  topics: string[];
}

export type StoredMenteeDirectionMap = Record<string, StoredDirectionBucket>;

export interface MenteeDirectionReadGroup {
  key: string;
  label: string;
  skills: TagDisplay[];
  topics: TagDisplay[];
  totalCount: number;
}

const STORAGE_KEY_PREFIX = 'xtalent:mentee-direction-map:v1:';
const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
const PRESET_CODE_TO_URL: Readonly<Record<string, string>> = {
  default_1: '/avatars/default_1.webp',
  default_2: '/avatars/default_2.webp',
  default_3: '/avatars/default_3.webp',
  default_4: '/avatars/default_4.webp',
  default_5: '/avatars/default_5.webp',
  default_6: '/avatars/default_6.webp',
};

export const DEFAULT_MENTEE_AVATAR_URL = '/avatars/default_1.webp';

function dedupeTags(
  items: ReadonlyArray<TagDisplay> | null | undefined
): TagDisplay[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const out: TagDisplay[] = [];
  for (const item of items) {
    const code = item?.subject_group?.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      subject_group: code,
      subject: item.subject?.trim() || code,
    });
  }
  return out;
}

function readBrowserLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function readStoredMenteeDirectionViewMap(
  userId: string | number | null | undefined,
  readRaw: (key: string) => string | null = readBrowserLocalStorage
): StoredMenteeDirectionMap | null {
  if (userId === undefined || userId === null) return null;
  const trimmedId = String(userId).trim();
  if (!trimmedId) return null;
  const raw = readRaw(`${STORAGE_KEY_PREFIX}${trimmedId}`);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const map = Object.create(null) as StoredMenteeDirectionMap;
    for (const [dirKey, bucket] of Object.entries(parsed)) {
      if (FORBIDDEN_OBJECT_KEYS.has(dirKey)) continue;
      if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) {
        continue;
      }
      const record = bucket as Record<string, unknown>;
      map[dirKey] = {
        skills: Array.isArray(record.skills)
          ? record.skills.filter((s): s is string => typeof s === 'string')
          : [],
        topics: Array.isArray(record.topics)
          ? record.topics.filter((t): t is string => typeof t === 'string')
          : [],
      };
    }
    return map;
  } catch {
    return null;
  }
}

export interface BuildMenteeDirectionReadGroupsInput {
  positions: ReadonlyArray<TagDisplay> | null | undefined;
  skills: ReadonlyArray<TagDisplay> | null | undefined;
  topics: ReadonlyArray<TagDisplay> | null | undefined;
  storedMap?: StoredMenteeDirectionMap | null;
}

/**
 * Builds per-direction read groups for Mentee B-1 profile display:
 * - Maps stored per-direction `skills` / `topics` codes against authoritative
 *   `want_skill` / `want_topic` TagDisplay items.
 * - Assigns any unassigned skill/topic onto the primary selected position
 *   (`positions[0]`) so existing/legacy tags never disappear.
 */
export function buildMenteeDirectionReadGroups({
  positions,
  skills,
  topics,
  storedMap = null,
}: BuildMenteeDirectionReadGroupsInput): MenteeDirectionReadGroup[] {
  const cleanPositions = dedupeTags(positions);
  if (cleanPositions.length === 0) return [];

  const cleanSkills = dedupeTags(skills);
  const cleanTopics = dedupeTags(topics);

  const skillByCode = new Map(cleanSkills.map((t) => [t.subject_group, t]));
  const topicByCode = new Map(cleanTopics.map((t) => [t.subject_group, t]));

  const coveredSkillCodes = new Set<string>();
  const coveredTopicCodes = new Set<string>();

  const groups: MenteeDirectionReadGroup[] = cleanPositions.map((pos) => {
    const entry =
      storedMap && Object.hasOwn(storedMap, pos.subject_group)
        ? storedMap[pos.subject_group]
        : undefined;
    const matchedSkills: TagDisplay[] = [];
    const matchedTopics: TagDisplay[] = [];

    if (entry && Array.isArray(entry.skills) && Array.isArray(entry.topics)) {
      const seenSkill = new Set<string>();
      for (const rawCode of entry.skills) {
        const code = rawCode.trim();
        const tag = skillByCode.get(code);
        if (!tag || seenSkill.has(code)) continue;
        seenSkill.add(code);
        coveredSkillCodes.add(code);
        matchedSkills.push(tag);
      }

      const seenTopic = new Set<string>();
      for (const rawCode of entry.topics) {
        const code = rawCode.trim();
        const tag = topicByCode.get(code);
        if (!tag || seenTopic.has(code)) continue;
        seenTopic.add(code);
        coveredTopicCodes.add(code);
        matchedTopics.push(tag);
      }
    }

    return {
      key: pos.subject_group,
      label: pos.subject,
      skills: matchedSkills,
      topics: matchedTopics,
      totalCount: matchedSkills.length + matchedTopics.length,
    };
  });

  const unassignedSkills = cleanSkills.filter(
    (s) => !coveredSkillCodes.has(s.subject_group)
  );
  const unassignedTopics = cleanTopics.filter(
    (t) => !coveredTopicCodes.has(t.subject_group)
  );

  if (unassignedSkills.length > 0 || unassignedTopics.length > 0) {
    const first = groups[0];
    const mergedSkills = dedupeTags([...first.skills, ...unassignedSkills]);
    const mergedTopics = dedupeTags([...first.topics, ...unassignedTopics]);
    groups[0] = {
      ...first,
      skills: mergedSkills,
      topics: mergedTopics,
      totalCount: mergedSkills.length + mergedTopics.length,
    };
  }

  return groups;
}

export function resolveMenteeAvatarSrc(
  avatar: string | null | undefined
): string {
  const trimmed = avatar?.trim() ?? '';
  if (!trimmed) return DEFAULT_MENTEE_AVATAR_URL;
  if (Object.hasOwn(PRESET_CODE_TO_URL, trimmed)) {
    return PRESET_CODE_TO_URL[trimmed];
  }
  return trimmed;
}

function parsePeriodEndRank(
  end: string | undefined,
  currentYear: number
): number {
  if (!end) return 0;
  const trimmed = end.trim().toLowerCase();
  if (trimmed === 'now' || trimmed === '至今') return currentYear + 1;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveMenteeLatestRole(
  userData: Pick<UserType, 'workExperiences'> | null | undefined,
  currentYear = new Date().getFullYear()
): { jobTitle: string; company: string } | null {
  const list = userData?.workExperiences;
  if (!list?.length) return null;

  let best = list[0];
  let bestEnd = parsePeriodEndRank(best.job_period_end, currentYear);
  let bestStart = Number(best.job_period_start) || 0;

  for (let i = 1; i < list.length; i += 1) {
    const candidate = list[i];
    const endRank = parsePeriodEndRank(candidate.job_period_end, currentYear);
    const startRank = Number(candidate.job_period_start) || 0;
    if (endRank > bestEnd || (endRank === bestEnd && startRank > bestStart)) {
      best = candidate;
      bestEnd = endRank;
      bestStart = startRank;
    }
  }

  const jobTitle = best.job?.trim() ?? '';
  const company = best.company?.trim() ?? '';
  if (!jobTitle && !company) return null;
  return { jobTitle, company };
}

export function resolveMenteeExperienceSummary(
  userData:
    | Pick<UserType, 'workExperiences' | 'years_of_experience'>
    | null
    | undefined,
  currentYear = new Date().getFullYear()
): string | undefined {
  const list = userData?.workExperiences;
  if (!list?.length) {
    return userData?.years_of_experience;
  }

  let totalYears = 0;
  let countedAny = false;
  for (const exp of list) {
    const startYear = Number(exp.job_period_start);
    if (!Number.isFinite(startYear) || startYear <= 0) continue;
    const rawEnd = exp.job_period_end?.trim().toLowerCase();
    const endYear =
      !rawEnd || rawEnd === 'now' || rawEnd === '至今'
        ? currentYear
        : Number(rawEnd);
    if (!Number.isFinite(endYear) || endYear < startYear) continue;
    countedAny = true;
    totalYears += Math.max(1, endYear - startYear);
  }

  if (!countedAny) {
    return userData?.years_of_experience;
  }
  return `${totalYears} 年`;
}

export function resolveMenteeIndustryHashtag(
  userData: Pick<UserType, 'industry' | 'industries'> | null | undefined
): string | null {
  if (!userData) return null;
  const rawIndustry =
    userData.industry?.trim() ||
    userData.industries?.[0]?.subject?.trim() ||
    '';
  const normalized = rawIndustry.replace(/^#+/, '').trim();
  return normalized ? `#${normalized}` : null;
}

export function isMenteeProfileEmpty(
  userData: UserType | null | undefined,
  safePersonalLinksCount: number,
  resolvedLocation?: string
): boolean {
  if (!userData) return true;
  const hasAbout = Boolean(userData.about?.trim());
  const hasIndustry = Boolean(resolveMenteeIndustryHashtag(userData));
  const hasExperienceYears = Boolean(userData.years_of_experience?.trim());
  const hasLocation = Boolean(resolvedLocation?.trim());
  const hasPreferences = Boolean(
    userData.want_position?.length ||
    userData.want_skill?.length ||
    userData.want_topic?.length
  );
  const hasWork = Boolean(userData.workExperiences?.length);
  const hasEducation = Boolean(userData.educations?.length);
  const hasLinks = safePersonalLinksCount > 0;

  return !(
    hasAbout ||
    hasIndustry ||
    hasExperienceYears ||
    hasLocation ||
    hasPreferences ||
    hasWork ||
    hasEducation ||
    hasLinks
  );
}
