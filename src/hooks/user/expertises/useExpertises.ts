import { useEffect, useState } from 'react';

import { ExpertiseType } from '@/services/profile//expertises'; // 若 interface 放在獨立檔案，請調整匯入路徑
import { fetchExpertises } from '@/services/profile/expertises';

export default function useExpertises(language: string) {
  const [expertises, setExpertises] = useState<ExpertiseType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExpertises = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchExpertises(language);
        setExpertises(data);
      } catch (err) {
        console.error('Failed to load expertises:', err);
        setError('Failed to load expertises');
      } finally {
        setIsLoading(false);
      }
    };
    loadExpertises();
  }, [language]);

  return { expertises, isLoading, error };
}
