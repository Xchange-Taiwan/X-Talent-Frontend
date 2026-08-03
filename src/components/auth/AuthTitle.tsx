import { ReactNode } from 'react';

interface AuthTitleProps {
  children: ReactNode;
}

export default function AuthTitle({ children }: AuthTitleProps) {
  return (
    <h1 className="text-center text-2xl leading-tight font-bold md:text-32">
      {children}
    </h1>
  );
}
