import { useEffect, useState } from 'react';

import { fetchCountries } from '@/services/country/countries';

interface LocationOption {
  value: string;
  text: string;
}

const useLocationOptions = (language: string) => {
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);

  const loadLocationOptions = async () => {
    try {
      const options = await fetchCountries(language);
      setLocationOptions(options);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLocationOptions();
  }, [language]);

  return { locationOptions };
};

export default useLocationOptions;
