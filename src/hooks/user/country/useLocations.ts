import { useMemo } from 'react';

import { getCountries, LocationType } from '@/services/profile/countries';

interface UseLocationsResult {
  locations: LocationType[];
  isLoading: false;
  error: null;
}

export default function useLocations(language: string): UseLocationsResult {
  const locations = useMemo(() => getCountries(language), [language]);
  return { locations, isLoading: false, error: null };
}
