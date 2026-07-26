import type { TagVO } from '@/types/tag';

/**
 * Safely casts and extracts the industry tag from the DTO format.
 * The BFF returns industry enriched as a TagVO-shaped object, but the OpenAPI
 * generator types it as Record<string, never> or similar because the BFF model
 * declares it as Optional[Dict[str, Any]].
 *
 * This adapter centralizes the cast to prevent duplicate as-unknown casts
 * across the codebase.
 *
 * @param industry The industry object from the backend DTO.
 * @returns The casted TagVO object, or null if the input is falsy.
 */
export function readIndustryTag(industry: unknown): TagVO | null {
  if (!industry) return null;
  return industry as TagVO;
}
