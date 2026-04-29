import { useEffect, useState } from 'react';

import { getCountries, LocationType } from '@/services/profile/countries';

const cache = new Map<string, LocationType[]>();
const inflight = new Map<string, Promise<LocationType[]>>();

interface UseLocationsResult {
  locations: LocationType[];
  isLoading: boolean;
  error: string | null;
}

export default function useLocations(language: string): UseLocationsResult {
  const [locations, setLocations] = useState<LocationType[]>(
    () => cache.get(language) ?? []
  );
  const [isLoading, setIsLoading] = useState(!cache.has(language));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached = cache.get(language);
    if (cached) {
      setLocations(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const promise =
      inflight.get(language) ??
      (() => {
        const p = getCountries(language).then((data) => {
          cache.set(language, data);
          inflight.delete(language);
          return data;
        });
        inflight.set(language, p);
        return p;
      })();

    promise
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
