import { useEffect, useState } from 'react';

import { fetchInterests, Interest } from '@/services/user/interests/interests';

const useInterests = (language: string) => {
  const [interestedPosition, setInterestedPosition] = useState<Interest[]>([]);
  const [skill, setSkill] = useState<Interest[]>([]);
  const [topic, setTopic] = useState<Interest[]>([]);
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

      setInterestedPosition(positions);
      setSkill(skills);
      setTopic(topics);
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

  return { interestedPosition, skill, topic, loading, error };
};

export default useInterests;
