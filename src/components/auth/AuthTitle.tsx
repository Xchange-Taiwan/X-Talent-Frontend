import { ReactNode } from 'react';

interface AuthTitleProps {
  children: ReactNode;
}

export default function AuthTitle({ children }: AuthTitleProps) {
  return (
    <h1 className="text-center text-2xl font-bold leading-tight md:text-[32px]">
      {children}
    </h1>
  );
}
