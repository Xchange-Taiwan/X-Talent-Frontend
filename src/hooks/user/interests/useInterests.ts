import { useEffect, useState } from 'react';

import { fetchInterests, InterestVO } from '@/services/profile/interests';

export type InterestsResult = {
  interestedPositions: InterestVO[];
  skills: InterestVO[];
  topics: InterestVO[];
  expertises: InterestVO[];
  whatIOffers: InterestVO[];
};

const interestsDataCache = new Map<string, InterestsResult>();
const interestsPromiseCache = new Map<string, Promise<InterestsResult>>();

export async function getInterestsCached(
  language: string
): Promise<InterestsResult> {
  const cached = interestsDataCache.get(language);
  if (cached) return cached;

  const inflight = interestsPromiseCache.get(language);
  if (inflight) return inflight;

  const promise = (async () => {
    const [positions, skills, topics] = await Promise.all([
      fetchInterests(language, 'INTERESTED_POSITION'),
      fetchInterests(language, 'SKILL'),
      fetchInterests(language, 'TOPIC'),
    ]);

    const result: InterestsResult = {
      interestedPositions: positions,
      skills,
      topics,
      expertises: skills,
      whatIOffers: topics,
    };

    interestsDataCache.set(language, result);
    interestsPromiseCache.delete(language);
    return result;
  })();

  interestsPromiseCache.set(language, promise);
  return promise;
}

function useInterests(language: string) {
  const [interestedPositions, setInterestedPositions] = useState<InterestVO[]>(
    []
  );
  const [skills, setSkills] = useState<InterestVO[]>([]);
  const [topics, setTopics] = useState<InterestVO[]>([]);
  const [expertises, setExpertises] = useState<InterestVO[]>([]);
  const [whatIOffers, setWhatIOffers] = useState<InterestVO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!language) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getInterestsCached(language);
        if (cancelled) return;

        setInterestedPositions(data.interestedPositions);
        setSkills(data.skills);
        setTopics(data.topics);
        setExpertises(data.expertises);
        setWhatIOffers(data.whatIOffers);
      } catch (e) {
        if (cancelled) return;
        setError('Failed to load interests');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [language]);

  return {
    interestedPositions,
    skills,
    topics,
    expertises,
    whatIOffers,
    isLoading,
    error,
  };
}

export default useInterests;
