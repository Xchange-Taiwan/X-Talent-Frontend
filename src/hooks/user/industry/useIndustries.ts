import { useEffect, useState } from 'react';

import { fetchIndustries, IndustryDTO } from '@/services/profile/industries';

export default function useIndustries(language: string) {
  const [industries, setIndustries] = useState<IndustryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadIndustries = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const industriesData = await fetchIndustries(language);
        setIndustries(industriesData);
      } catch (err) {
        console.error('Failed to load industries:', err);
        setError('Failed to load industries');
      } finally {
        setIsLoading(false);
      }
    };
    loadIndustries();
  }, [language]);

  return { industries, isLoading, error };
}
