import { safeGetStorage, safeSetStorage } from '@/lib/storage';
import type { TagDisplay } from '@/types/user';

export interface DirectionBucketSelection {
  skills: string[];
  topics: string[];
}

export type MenteeDirectionMap = Record<string, DirectionBucketSelection>;
export type StoredMenteeDirectionMap = MenteeDirectionMap;
export type DirectionBucketKey = 'skills' | 'topics';

export interface MenteeDirectionReadGroup {
  key: string;
  label: string;
  skills: TagDisplay[];
  topics: TagDisplay[];
  totalCount: number;
}

const STORAGE_KEY_PREFIX = 'xtalent:mentee-direction-map:v1:';
const DEFAULT_MAX_TOTAL = 10;
const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function getOwnDirectionEntry(
  map: MenteeDirectionMap | null | undefined,
  key: string
): DirectionBucketSelection | undefined {
  if (!map || !Object.hasOwn(map, key)) return undefined;
  return map[key];
}

function setOwnDirectionEntry(
  map: MenteeDirectionMap,
  key: string,
  value: DirectionBucketSelection
): void {
  Object.defineProperty(map, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

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

function uniqueStrings(items: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function flattenDirectionBucket(
  directionMap: MenteeDirectionMap,
  positions: ReadonlyArray<string>,
  bucket: DirectionBucketKey,
  maxTotal = DEFAULT_MAX_TOTAL
): string[] {
  const collected: string[] = [];
  for (const pos of positions) {
    const entry = getOwnDirectionEntry(directionMap, pos);
    if (!entry) continue;
    collected.push(...entry[bucket]);
  }
  return uniqueStrings(collected).slice(0, maxTotal);
}

export interface HydrateMenteeDirectionMapInput {
  positions: ReadonlyArray<string>;
  flatSkills: ReadonlyArray<string>;
  flatTopics: ReadonlyArray<string>;
  storedMap?: MenteeDirectionMap | null;
  maxTotal?: number;
}

/**
 * Reconciles a stored per-direction map against authoritative backend
 * `want_position` / `want_skill` / `want_topic` arrays without requiring any
 * backend `ProfileDTO` change:
 * - Retains per-direction selections that remain valid in `flatSkills` / `flatTopics`.
 * - Assigns any unassigned backend skill/topic (e.g. legacy profile or edited
 *   elsewhere) onto the primary selected position (`positions[0]`) so zero
 *   existing tags are lost.
 */
export function hydrateMenteeDirectionMap({
  positions,
  flatSkills,
  flatTopics,
  storedMap = null,
  maxTotal = DEFAULT_MAX_TOTAL,
}: HydrateMenteeDirectionMapInput): MenteeDirectionMap {
  const cleanPositions = uniqueStrings(positions).slice(0, maxTotal);
  if (cleanPositions.length === 0) return {};

  const authoritativeSkills = uniqueStrings(flatSkills).slice(0, maxTotal);
  const authoritativeTopics = uniqueStrings(flatTopics).slice(0, maxTotal);
  const skillSet = new Set(authoritativeSkills);
  const topicSet = new Set(authoritativeTopics);

  const coveredSkills = new Set<string>();
  const coveredTopics = new Set<string>();
  const nextMap: MenteeDirectionMap = {};

  for (const pos of cleanPositions) {
    const storedEntry = getOwnDirectionEntry(storedMap, pos);
    const keptSkills =
      storedEntry && Array.isArray(storedEntry.skills)
        ? uniqueStrings(storedEntry.skills).filter((s) => skillSet.has(s))
        : [];
    const keptTopics =
      storedEntry && Array.isArray(storedEntry.topics)
        ? uniqueStrings(storedEntry.topics).filter((t) => topicSet.has(t))
        : [];

    for (const s of keptSkills) coveredSkills.add(s);
    for (const t of keptTopics) coveredTopics.add(t);

    setOwnDirectionEntry(nextMap, pos, {
      skills: keptSkills,
      topics: keptTopics,
    });
  }

  const primaryPosition = cleanPositions[0];
  const primaryEntry = getOwnDirectionEntry(nextMap, primaryPosition) ?? {
    skills: [],
    topics: [],
  };
  const unassignedSkills = authoritativeSkills.filter(
    (s) => !coveredSkills.has(s)
  );
  const unassignedTopics = authoritativeTopics.filter(
    (t) => !coveredTopics.has(t)
  );

  if (unassignedSkills.length > 0 || unassignedTopics.length > 0) {
    setOwnDirectionEntry(nextMap, primaryPosition, {
      skills: uniqueStrings([
        ...primaryEntry.skills,
        ...unassignedSkills,
      ]).slice(0, maxTotal),
      topics: uniqueStrings([
        ...primaryEntry.topics,
        ...unassignedTopics,
      ]).slice(0, maxTotal),
    });
  }

  return nextMap;
}

export interface BuildMenteeDirectionReadGroupsInput {
  positions: ReadonlyArray<TagDisplay> | null | undefined;
  skills: ReadonlyArray<TagDisplay> | null | undefined;
  topics: ReadonlyArray<TagDisplay> | null | undefined;
  storedMap?: MenteeDirectionMap | null;
}

/**
 * Projects per-direction read groups for Mentee B-1 profile display on top of
 * `hydrateMenteeDirectionMap` so edit hydration and read display share a single
 * unassigned-tag reconciliation algorithm onto `positions[0]`.
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

  const reconciled = hydrateMenteeDirectionMap({
    positions: cleanPositions.map((p) => p.subject_group),
    flatSkills: cleanSkills.map((s) => s.subject_group),
    flatTopics: cleanTopics.map((t) => t.subject_group),
    storedMap,
    maxTotal: Number.MAX_SAFE_INTEGER,
  });

  return cleanPositions.map((pos) => {
    const entry = getOwnDirectionEntry(reconciled, pos.subject_group);
    const matchedSkills = (entry?.skills ?? []).flatMap((code) => {
      const tag = skillByCode.get(code);
      return tag ? [tag] : [];
    });
    const matchedTopics = (entry?.topics ?? []).flatMap((code) => {
      const tag = topicByCode.get(code);
      return tag ? [tag] : [];
    });

    return {
      key: pos.subject_group,
      label: pos.subject,
      skills: matchedSkills,
      topics: matchedTopics,
      totalCount: matchedSkills.length + matchedTopics.length,
    };
  });
}

/**
 * Updates active directions when `want_position` changes:
 * - Preserves existing selections for still-selected directions.
 * - Initializes newly checked directions with empty arrays.
 * - Immediately clears skills & topics of any deselected direction.
 */
export function syncMenteePositions(
  prevMap: MenteeDirectionMap,
  nextPositions: ReadonlyArray<string>,
  maxTotal = DEFAULT_MAX_TOTAL
): {
  directionMap: MenteeDirectionMap;
  flatSkills: string[];
  flatTopics: string[];
} {
  const cleanPositions = uniqueStrings(nextPositions).slice(0, maxTotal);
  const directionMap: MenteeDirectionMap = {};

  for (const pos of cleanPositions) {
    const existing = getOwnDirectionEntry(prevMap, pos);
    setOwnDirectionEntry(
      directionMap,
      pos,
      existing
        ? {
            skills: uniqueStrings(existing.skills).slice(0, maxTotal),
            topics: uniqueStrings(existing.topics).slice(0, maxTotal),
          }
        : { skills: [], topics: [] }
    );
  }

  return {
    directionMap,
    flatSkills: flattenDirectionBucket(
      directionMap,
      cleanPositions,
      'skills',
      maxTotal
    ),
    flatTopics: flattenDirectionBucket(
      directionMap,
      cleanPositions,
      'topics',
      maxTotal
    ),
  };
}

/**
 * Computes the dynamic `maxSelected` cap for `activeDirection` so the
 * cross-direction unique union never exceeds `maxTotal` (10) while still
 * permitting items shared with another direction.
 */
export function computeDirectionSelectLimit(
  directionMap: MenteeDirectionMap,
  positions: ReadonlyArray<string>,
  activeDirection: string,
  bucket: DirectionBucketKey,
  maxTotal = DEFAULT_MAX_TOTAL
): number {
  const activeItems =
    getOwnDirectionEntry(directionMap, activeDirection)?.[bucket] ?? [];
  const totalUnique = flattenDirectionBucket(
    directionMap,
    positions,
    bucket,
    Number.MAX_SAFE_INTEGER
  );
  const remainingUniqueBudget = Math.max(0, maxTotal - totalUnique.length);
  return Math.min(maxTotal, activeItems.length + remainingUniqueBudget);
}

/**
 * Updates `skills` or `topics` for a single `direction` while keeping other
 * directions untouched and enforcing the `maxTotal` cross-direction cap.
 */
export function updateDirectionBucket(
  prevMap: MenteeDirectionMap,
  positions: ReadonlyArray<string>,
  direction: string,
  bucket: DirectionBucketKey,
  nextItems: ReadonlyArray<string>,
  maxTotal = DEFAULT_MAX_TOTAL
): {
  directionMap: MenteeDirectionMap;
  flatItems: string[];
} {
  const cleanPositions = uniqueStrings(positions).slice(0, maxTotal);
  const otherUnique = new Set<string>();
  for (const pos of cleanPositions) {
    if (pos === direction) continue;
    const items = getOwnDirectionEntry(prevMap, pos)?.[bucket] ?? [];
    for (const item of items) otherUnique.add(item);
  }

  const sanitizedForDirection: string[] = [];
  let newUniqueAdded = 0;
  const maxNewUnique = Math.max(0, maxTotal - otherUnique.size);

  for (const item of uniqueStrings(nextItems)) {
    if (sanitizedForDirection.length >= maxTotal) break;
    if (otherUnique.has(item)) {
      sanitizedForDirection.push(item);
    } else if (newUniqueAdded < maxNewUnique) {
      sanitizedForDirection.push(item);
      newUniqueAdded += 1;
    }
  }

  const prevEntry = getOwnDirectionEntry(prevMap, direction) ?? {
    skills: [],
    topics: [],
  };
  const directionMap: MenteeDirectionMap = { ...prevMap };
  setOwnDirectionEntry(directionMap, direction, {
    ...prevEntry,
    [bucket]: sanitizedForDirection,
  });

  return {
    directionMap,
    flatItems: flattenDirectionBucket(
      directionMap,
      cleanPositions,
      bucket,
      maxTotal
    ),
  };
}

function getStorageKey(
  userId: string | number | null | undefined
): string | null {
  if (userId === undefined || userId === null) return null;
  const trimmed = String(userId).trim();
  return trimmed ? `${STORAGE_KEY_PREFIX}${trimmed}` : null;
}

export function readStoredMenteeDirectionMap(
  userId: string | number | null | undefined,
  readRaw: (key: string) => string | null = safeGetStorage
): MenteeDirectionMap | null {
  const key = getStorageKey(userId);
  if (!key) return null;
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const result: MenteeDirectionMap = {};
    for (const [pos, val] of Object.entries(parsed)) {
      if (FORBIDDEN_OBJECT_KEYS.has(pos)) continue;
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const record = val as Record<string, unknown>;
      const skills = Array.isArray(record.skills)
        ? uniqueStrings(
            record.skills.filter((s): s is string => typeof s === 'string')
          )
        : [];
      const topics = Array.isArray(record.topics)
        ? uniqueStrings(
            record.topics.filter((t): t is string => typeof t === 'string')
          )
        : [];
      setOwnDirectionEntry(result, pos, { skills, topics });
    }
    return result;
  } catch {
    return null;
  }
}

export function writeStoredMenteeDirectionMap(
  userId: string | number | null | undefined,
  directionMap: MenteeDirectionMap,
  writeRaw: (key: string, value: string) => void = safeSetStorage
): void {
  const key = getStorageKey(userId);
  if (!key) return;
  writeRaw(key, JSON.stringify(directionMap));
}
