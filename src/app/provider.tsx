'use client';
import { FC, ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';

const Provider: FC<{ children: ReactNode }> = ({ children }) => {
  return <SessionProvider>{children}</SessionProvider>;
};

export default Provider;
