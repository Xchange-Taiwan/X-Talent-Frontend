import { useEffect, useState } from 'react';

import { fetchCountries, LocationType } from '@/services/profile/countries';

const locationsCache = new Map<string, LocationType[]>();
const locationsPromiseCache = new Map<string, Promise<LocationType[]>>();

async function fetchCountriesCached(language: string): Promise<LocationType[]> {
  if (locationsCache.has(language)) return locationsCache.get(language)!;

  const inflight = locationsPromiseCache.get(language);
  if (inflight) return inflight;

  const promise = (async () => {
    const result = await fetchCountries(language);
    locationsCache.set(language, result);
    locationsPromiseCache.delete(language);
    return result;
  })();

  locationsPromiseCache.set(language, promise);
  return promise;
}

export default function useLocations(language: string) {
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCountriesCached(language);
        if (!cancelled) setLocations(data);
      } catch (err) {
        console.error('Failed to fetch countries:', err);
        if (!cancelled) setError('Failed to load location options');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return { locations, isLoading, error };
}
