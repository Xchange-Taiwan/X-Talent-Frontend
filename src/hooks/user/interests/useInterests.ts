import { useEffect, useState } from 'react';

import { fetchInterests, InterestDTO } from '@/services/profile/interests';

export type InterestsResult = {
  interestedPositions: InterestDTO[];
  skills: InterestDTO[];
  topics: InterestDTO[];
  expertises: InterestDTO[];
  whatIOffers: InterestDTO[];
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

const useInterests = (language: string) => {
  const [interestedPositions, setInterestedPositions] = useState<InterestDTO[]>(
    []
  );
  const [skills, setSkills] = useState<InterestDTO[]>([]);
  const [topics, setTopics] = useState<InterestDTO[]>([]);
  const [expertises, setExpertises] = useState<InterestDTO[]>([]);
  const [whatIOffers, setWhatIOffers] = useState<InterestDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!language) {
        setLoading(false);
        return;
      }

      setLoading(true);
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
        console.error('Failed to load interests:', e);
        if (cancelled) return;
        setError('Failed to load interests');
      } finally {
        if (!cancelled) setLoading(false);
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
    loading,
    error,
  };
};

export default useInterests;
