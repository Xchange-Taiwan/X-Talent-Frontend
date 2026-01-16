'use client';

import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Page() {
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const loadSession = async () => {
      const session = await getSession();
      const userId = session?.user?.id;

      if (userId) {
        setUserId(String(userId));
      } else {
        setUserId('');
      }
    };

    loadSession();
  }, []);

  return <div>{userId}</div>;
}
