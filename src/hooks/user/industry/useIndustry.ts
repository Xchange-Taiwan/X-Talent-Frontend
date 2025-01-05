import { useEffect, useState } from 'react';

import { fetchIndustry, IndustryType } from '@/services/user/industry/industry';

const useIndustry = (language: string) => {
  const [industries, setIndustries] = useState<IndustryType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      setError(null);

      const industriesData = await fetchIndustry(language);
      setIndustries(industriesData);
    } catch (err) {
      console.error('Failed to load industries:', err);
      setError('Failed to load industries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIndustries();
  }, [language]);

  return { industries, loading, error };
};

export default useIndustry;
