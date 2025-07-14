import { useEffect, useState } from 'react';

import { fetchInterests, InterestType } from '@/services/profile/interests';

const useInterests = (language: string) => {
  const [interestedPositions, setInterestedPositions] = useState<
    InterestType[]
  >([]);
  const [skills, setSkills] = useState<InterestType[]>([]);
  const [topics, setTopics] = useState<InterestType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadInterests = async () => {
    try {
      setLoading(true);
      setError(null);

      const [positions, skills, topics] = await Promise.all([
        fetchInterests(language, 'INTERESTED_POSITION'),
        fetchInterests(language, 'SKILL'),
        fetchInterests(language, 'TOPIC'),
      ]);

      setInterestedPositions(positions);
      setSkills(skills);
      setTopics(topics);
    } catch (err) {
      console.error('Failed to load interests:', err);
      setError('Failed to load interests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterests();
  }, [language]);

  return { interestedPositions, skills, topics, loading, error };
};

export default useInterests;
