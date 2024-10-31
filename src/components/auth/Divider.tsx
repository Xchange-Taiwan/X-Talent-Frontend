import { ReactNode } from 'react';

interface DividerProps {
  children: ReactNode;
}

export default function Divider({ children }: DividerProps) {
  return (
    <div className="flex items-center">
      <div className="h-[1px] flex-1 bg-background-border" />
      <p className="flex-0 text-neutral-600 px-2">{children}</p>
      <div className="h-[1px] flex-1 bg-background-border" />
    </div>
  );
}
