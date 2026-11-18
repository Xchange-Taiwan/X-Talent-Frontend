'use client';

import { useEffect, useState } from 'react';

/**
 * Converts a `Blob` / `File` into an object URL and reliably revokes it
 * whenever the input changes or the component unmounts.
 */
export function useObjectUrl(file: Blob | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return objectUrl;
}
