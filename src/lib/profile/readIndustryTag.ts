import type { TagVO } from '@/types/tag';

/**
 * Type guard to determine if a value is a valid TagVO-like object.
 */
function isTagVO(value: unknown): value is TagVO {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // A valid TagVO from the backend typically has 'subject_group' or 'subject' or 'id'
  return 'subject_group' in value || 'subject' in value || 'id' in value;
}

/**
 * Safely casts and extracts the industry tag from the DTO format.
 * The BFF returns industry enriched as a TagVO-shaped object, but the OpenAPI
 * generator types it as Record<string, never> or similar because the BFF model
 * declares it as Optional[Dict[str, Any]].
 *
 * This adapter centralizes the cast and performs runtime type narrowing to ensure
 * type safety when reading enriched fields.
 *
 * @param industry The industry object from the backend DTO.
 * @returns The verified TagVO object, or null if the input is invalid or falsy.
 */
export function readIndustryTag(industry: unknown): TagVO | null {
  if (isTagVO(industry)) {
    return industry;
  }
  return null;
}
