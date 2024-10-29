import React, { ReactNode } from 'react';

interface AuthTitleProps {
  children: ReactNode;
}

export default function AuthTitle({ children }: AuthTitleProps) {
  return (
    <h1 className="text-center text-[32px] font-bold leading-tight">
      {children}
    </h1>
  );
}
