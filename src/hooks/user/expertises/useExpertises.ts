import { useEffect, useState } from 'react';

import { ExpertiseType, fetchExpertises } from '@/services/profile/expertises';

const expertisesCache = new Map<string, ExpertiseType[]>();
const expertisesPromiseCache = new Map<string, Promise<ExpertiseType[]>>();

async function fetchExpertisesCached(
  language: string
): Promise<ExpertiseType[]> {
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

export default function useExpertises(language: string) {
  const [expertises, setExpertises] = useState<ExpertiseType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
