import { useEffect, useState } from 'react';

import { fetchIndustries, IndustryDTO } from '@/services/profile/industries';

const industriesCache = new Map<string, IndustryDTO[]>();
const industriesPromiseCache = new Map<string, Promise<IndustryDTO[]>>();

async function fetchIndustriesCached(language: string): Promise<IndustryDTO[]> {
  if (industriesCache.has(language)) return industriesCache.get(language)!;

  const inflight = industriesPromiseCache.get(language);
  if (inflight) return inflight;

  const promise = (async () => {
    const result = await fetchIndustries(language);
    industriesCache.set(language, result);
    industriesPromiseCache.delete(language);
    return result;
  })();

  industriesPromiseCache.set(language, promise);
  return promise;
}

export default function useIndustries(language: string) {
  const [industries, setIndustries] = useState<IndustryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchIndustriesCached(language);
        if (!cancelled) setIndustries(data);
      } catch (err) {
        console.error('Failed to load industries:', err);
        if (!cancelled) setError('Failed to load industries');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return { industries, isLoading, error };
}
