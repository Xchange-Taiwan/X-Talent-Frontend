import { useEffect, useRef, useState } from 'react';

import { fetchExpertises, ProfessionVO } from '@/services/profile/expertises';

const expertisesCache = new Map<string, ProfessionVO[]>();
const expertisesPromiseCache = new Map<string, Promise<ProfessionVO[]>>();

async function fetchExpertisesCached(
  language: string
): Promise<ProfessionVO[]> {
  if (expertisesCache.has(language)) return expertisesCache.get(language)!;

  const inflight = expertisesPromiseCache.get(language);
  if (inflight) return inflight;

  const promise = (async () => {
    const result = await fetchExpertises(language);
    expertisesCache.set(language, result);
    expertisesPromiseCache.delete(language);
    return result;
  })();

  expertisesPromiseCache.set(language, promise);
  return promise;
}

export default function useExpertises(
  language: string,
  initialData?: ProfessionVO[]
) {
  const initialDataRef = useRef(initialData);

  const [expertises, setExpertises] = useState<ProfessionVO[]>(
    initialData ?? []
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    initialData === undefined
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDataRef.current !== undefined) {
      expertisesCache.set(language, initialDataRef.current);
      initialDataRef.current = undefined;
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchExpertisesCached(language);
        if (!cancelled) setExpertises(data);
      } catch (err) {
        if (!cancelled) setError('Failed to load expertises');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return { expertises, isLoading, error };
}
