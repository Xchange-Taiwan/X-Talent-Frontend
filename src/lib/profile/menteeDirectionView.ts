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
    const map: StoredMenteeDirectionMap = {};
    for (const [dirKey, bucket] of Object.entries(parsed)) {
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
    const entry = storedMap?.[pos.subject_group];
    const matchedSkills: TagDisplay[] = [];
    const matchedTopics: TagDisplay[] = [];

    if (entry) {
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

export function resolveMenteeIndustryHashtag(
  userData: Pick<UserType, 'industry' | 'industries'> | null | undefined
): string | null {
  if (!userData) return null;
  const rawIndustry =
    userData.industry?.trim() || userData.industries?.[0]?.subject?.trim() || '';
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
