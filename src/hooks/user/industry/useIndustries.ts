import { useEffect, useState } from 'react';

import { fetchIndustries, IndustryDTO } from '@/services/profile/industries';

const useIndustries = (language: string) => {
  const [industries, setIndustries] = useState<IndustryDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadIndustries = async () => {
      try {
        setLoading(true);
        setError(null);
        const industriesData = await fetchIndustries(language);
        setIndustries(industriesData);
      } catch (err) {
        console.error('Failed to load industries:', err);
        setError('Failed to load industries');
      } finally {
        setLoading(false);
      }
    };
    loadIndustries();
  }, [language]);

  return { industries, loading, error };
};

export default useIndustries;
