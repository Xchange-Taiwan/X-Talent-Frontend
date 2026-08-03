'use client';

import { createContext, ReactNode, useContext } from 'react';

import type { SessionHint } from '@/lib/auth/sessionHint';

const SessionHintContext = createContext<SessionHint | null | undefined>(
  undefined
);

export function SessionHintProvider({
  children,
  value,
}: {
  children?: ReactNode;
  value: SessionHint | null;
}) {
  return (
    <SessionHintContext.Provider value={value}>
      {children}
    </SessionHintContext.Provider>
  );
}

export function useInitialSessionHint() {
  return useContext(SessionHintContext);
}
