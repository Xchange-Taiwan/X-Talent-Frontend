'use client';
import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider } from '@mui/material/styles';
import { SessionProvider } from 'next-auth/react';
import { FC, ReactNode } from 'react';

const Provider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <StyledEngineProvider injectFirst>
      <SessionProvider>
        <CssBaseline />
        {children}
      </SessionProvider>
    </StyledEngineProvider>
  );
};

export default Provider;
