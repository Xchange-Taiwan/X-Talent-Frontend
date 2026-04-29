import { useEffect, useRef, useState } from 'react';

import { fetchIndustries, ProfessionVO } from '@/services/profile/industries';

const industriesCache = new Map<string, ProfessionVO[]>();
const industriesPromiseCache = new Map<string, Promise<ProfessionVO[]>>();

async function fetchIndustriesCached(
  language: string
): Promise<ProfessionVO[]> {
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

export default function useIndustries(
  language: string,
  initialData?: ProfessionVO[]
) {
  // Snapshot at mount — once consumed, language switches go through the
  // normal client fetch path even if the parent re-passes the same prop.
  const initialDataRef = useRef(initialData);

  const [industries, setIndustries] = useState<ProfessionVO[]>(
    initialData ?? []
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    initialData === undefined
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDataRef.current !== undefined) {
      // Prime in-memory cache so other consumers of fetchIndustriesCached
      // (and remounts of this hook) skip the round trip too.
      industriesCache.set(language, initialDataRef.current);
      initialDataRef.current = undefined;
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchIndustriesCached(language);
        if (!cancelled) setIndustries(data);
      } catch (err) {
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
