'use client';

import { AsyncReadManager, useAsyncRead } from '@/hooks/useAsyncRead';
import { createKeyedCache } from '@/lib/createKeyedCache';
import { getCountries } from '@/services/profile/countries';
import type { LocationType } from '@/types/location';

export const LOCATIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const locationsCache = createKeyedCache<string, LocationType[]>({
  ttlMs: LOCATIONS_CACHE_TTL_MS,
});

export const locationsReadManager = new AsyncReadManager<
  string,
  LocationType[]
>(locationsCache);

interface UseLocationsResult {
  locations: LocationType[];
  isLoading: boolean;
  error: string | null;
}

export default function useLocations(language: string): UseLocationsResult {
  const { data, isLoading, error } = useAsyncRead(
    locationsReadManager,
    language,
    (signal) => getCountries(language, signal),
    { ttlMs: LOCATIONS_CACHE_TTL_MS }
  );

  return {
    locations: data ?? [],
    isLoading,
    error: error ? 'Failed to load location options' : null,
  };
}
