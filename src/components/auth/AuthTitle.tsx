import { ReactNode } from 'react';

interface AuthTitleProps {
  children: ReactNode;
}

export default function AuthTitle({ children }: AuthTitleProps) {
  return (
    <h1 className="md:text-32 text-center text-2xl leading-tight font-bold">
      {children}
    </h1>
  );
}
