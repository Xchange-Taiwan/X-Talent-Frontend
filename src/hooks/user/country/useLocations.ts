import { useEffect, useState } from 'react';

import { createKeyedCache } from '@/lib/createKeyedCache';
import { getCountries } from '@/services/profile/countries';
import type { LocationType } from '@/types/location';

export const LOCATIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const locationsCache = createKeyedCache<string, LocationType[]>({
  ttlMs: LOCATIONS_CACHE_TTL_MS,
});

interface UseLocationsResult {
  locations: LocationType[];
  isLoading: boolean;
  error: string | null;
}

export default function useLocations(language: string): UseLocationsResult {
  const [locations, setLocations] = useState<LocationType[]>(
    () => locationsCache.get(language) ?? []
  );
  const [isLoading, setIsLoading] = useState(
    () => !locationsCache.has(language)
  );
  const [error, setError] = useState<string | null>(null);

  // Synchronously update state on language prop change during render (Derived State pattern)
  const [prevLang, setPrevLang] = useState(language);
  if (prevLang !== language) {
    setPrevLang(language);
    setLocations(locationsCache.get(language) ?? []);
    setIsLoading(!locationsCache.has(language));
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    const cached = locationsCache.get(language);
    if (cached) {
      setLocations(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    locationsCache
      .fetch(language, () => getCountries(language))
      .then((data) => {
        if (!cancelled) {
          setLocations(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load location options');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  return { locations, isLoading, error };
}
