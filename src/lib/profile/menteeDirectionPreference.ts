import { safeGetStorage, safeSetStorage } from '@/lib/storage';

export interface DirectionBucketSelection {
  skills: string[];
  topics: string[];
}

export type MenteeDirectionMap = Record<string, DirectionBucketSelection>;
export type DirectionBucketKey = 'skills' | 'topics';

const STORAGE_KEY_PREFIX = 'xtalent:mentee-direction-map:v1:';
const DEFAULT_MAX_TOTAL = 10;

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
    const entry = directionMap[pos];
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
    const storedEntry = storedMap?.[pos];
    const keptSkills = storedEntry
      ? uniqueStrings(storedEntry.skills).filter((s) => skillSet.has(s))
      : [];
    const keptTopics = storedEntry
      ? uniqueStrings(storedEntry.topics).filter((t) => topicSet.has(t))
      : [];

    for (const s of keptSkills) coveredSkills.add(s);
    for (const t of keptTopics) coveredTopics.add(t);

    nextMap[pos] = {
      skills: keptSkills,
      topics: keptTopics,
    };
  }

  const primaryPosition = cleanPositions[0];
  const unassignedSkills = authoritativeSkills.filter(
    (s) => !coveredSkills.has(s)
  );
  const unassignedTopics = authoritativeTopics.filter(
    (t) => !coveredTopics.has(t)
  );

  if (unassignedSkills.length > 0 || unassignedTopics.length > 0) {
    nextMap[primaryPosition] = {
      skills: uniqueStrings([
        ...nextMap[primaryPosition].skills,
        ...unassignedSkills,
      ]).slice(0, maxTotal),
      topics: uniqueStrings([
        ...nextMap[primaryPosition].topics,
        ...unassignedTopics,
      ]).slice(0, maxTotal),
    };
  }

  return nextMap;
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
    const existing = prevMap[pos];
    directionMap[pos] = existing
      ? {
          skills: uniqueStrings(existing.skills).slice(0, maxTotal),
          topics: uniqueStrings(existing.topics).slice(0, maxTotal),
        }
      : { skills: [], topics: [] };
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
  const activeItems = directionMap[activeDirection]?.[bucket] ?? [];
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
    const items = prevMap[pos]?.[bucket] ?? [];
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

  const prevEntry = prevMap[direction] ?? { skills: [], topics: [] };
  const directionMap: MenteeDirectionMap = {
    ...prevMap,
    [direction]: {
      ...prevEntry,
      [bucket]: sanitizedForDirection,
    },
  };

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

function getStorageKey(userId: string | number | undefined): string | null {
  if (userId === undefined || userId === null) return null;
  const trimmed = String(userId).trim();
  return trimmed ? `${STORAGE_KEY_PREFIX}${trimmed}` : null;
}

export function readStoredMenteeDirectionMap(
  userId: string | number | undefined,
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
      result[pos] = { skills, topics };
    }
    return result;
  } catch {
    return null;
  }
}

export function writeStoredMenteeDirectionMap(
  userId: string | number | undefined,
  directionMap: MenteeDirectionMap,
  writeRaw: (key: string, value: string) => void = safeSetStorage
): void {
  const key = getStorageKey(userId);
  if (!key) return;
  writeRaw(key, JSON.stringify(directionMap));
}
