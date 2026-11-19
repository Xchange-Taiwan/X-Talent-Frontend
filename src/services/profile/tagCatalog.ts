import { apiClient } from '@/lib/apiClient';
import { isAbortError } from '@/lib/errorUtils';
import {
  IndustryOption,
  TagCatalogsByBucket,
  TagCatalogsVO,
  TagCatalogVO,
} from '@/types/tagCatalog';

const SAFE_LANGUAGE_RE = /^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,8})?$/;

function isValidCatalogBucketPayload(
  candidate: unknown
): candidate is TagCatalogsByBucket {
  if (!candidate || typeof candidate !== 'object') return false;
  const rec = candidate as Record<string, unknown>;
  return (
    Array.isArray(rec.want_position) &&
    Array.isArray(rec.want_skill) &&
    Array.isArray(rec.want_topic) &&
    Array.isArray(rec.have_skill) &&
    Array.isArray(rec.have_topic) &&
    Array.isArray(rec.industry) &&
    rec.want_position.length > 0 &&
    rec.want_skill.length > 0 &&
    rec.want_topic.length > 0
  );
}

export const EMPTY_TAG_CATALOGS: TagCatalogsByBucket = {
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
  industry: [],
};

// Industry rows have parent_subject_group=NULL in the catalog, so the BFF
// surfaces each industry as a top-level "group" with empty leaves. Project
// each group back into a flat option so consumers can render a single-level
// list.
function extractIndustryOptions(
  catalog: TagCatalogVO | undefined
): IndustryOption[] {
  if (!catalog) return [];
  return (catalog.groups ?? []).map((g) => ({
    subject_group: g.subject_group,
    subject: g.subject,
  }));
}

// BE returns a flat catalog keyed by `kind` (`skill`/`topic`/`position`/
// `industry`). The same skill catalog is reused for both want_skill (mentee
// picks) and have_skill (mentor picks); likewise topic. Position only applies
// to want_position. Industry is flat — see extractIndustryOptions.
export function splitCatalogsByBucket(
  catalogs: TagCatalogsVO | null | undefined
): TagCatalogsByBucket {
  if (!catalogs?.catalogs) return { ...EMPTY_TAG_CATALOGS };
  const skillGroups = catalogs.catalogs.skill?.groups ?? [];
  const topicGroups = catalogs.catalogs.topic?.groups ?? [];
  const positionGroups = catalogs.catalogs.position?.groups ?? [];
  return {
    want_position: positionGroups,
    want_skill: skillGroups,
    want_topic: topicGroups,
    have_skill: skillGroups,
    have_topic: topicGroups,
    industry: extractIndustryOptions(catalogs.catalogs.industry),
  };
}

export async function fetchTagCatalog(
  language: string,
  signal?: AbortSignal,
  localFetch?: typeof fetch | null
): Promise<TagCatalogsByBucket> {
  try {
    const data = await apiClient.getUnwrapped<TagCatalogsVO>(
      `/v1/users/${language}/tags/catalog`,
      {
        auth: false,
        ...(signal !== undefined ? { signal } : {}),
      }
    );
    return splitCatalogsByBucket(data);
  } catch (err) {
    if (isAbortError(err, signal)) {
      throw err;
    }

    const effectiveLocalFetch =
      localFetch !== undefined
        ? localFetch
        : typeof window !== 'undefined' && typeof window.fetch === 'function'
          ? window.fetch.bind(window)
          : null;

    const trimmedLanguage = language.trim();
    if (effectiveLocalFetch && SAFE_LANGUAGE_RE.test(trimmedLanguage)) {
      try {
        const res = await effectiveLocalFetch(
          `/api/tags/${encodeURIComponent(trimmedLanguage)}/catalog`,
          { signal }
        );
        if (res.ok) {
          const parsed: unknown = await res.json();
          if (isValidCatalogBucketPayload(parsed)) {
            return parsed;
          }
        }
      } catch (fallbackErr) {
        if (isAbortError(fallbackErr, signal)) {
          throw fallbackErr;
        }
      }
    }

    throw err;
  }
}
