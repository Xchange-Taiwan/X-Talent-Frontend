import { useEffect, useState } from 'react';

import { fetchCountries, LocationType } from '@/services/profile/countries';

export default function useLocations(language: string) {
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    loadLocationOptions();
  }, [language]);

  return { locations, isLoading, error };
}
