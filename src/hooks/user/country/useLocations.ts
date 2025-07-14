import { useEffect, useState } from 'react';

import { fetchCountries } from '@/services/profile/countries';
import { LocationType } from '@/services/profile/countries';

const useLocations = (language: string) => {
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLocationOptions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const options: LocationType[] = await fetchCountries(language);
      setLocations(options);
    } catch (err) {
      console.error('Failed to fetch countries:', err);
      setError('Failed to load location options');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocationOptions();
  }, [language]);

  return { locations, isLoading, error };
};

export default useLocations;
