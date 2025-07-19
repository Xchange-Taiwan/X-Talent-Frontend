import { ReactNode } from 'react';

interface DividerProps {
  children?: ReactNode;
  className?: string;
}

export default function Divider({ children, className = '' }: DividerProps) {
  return (
    <div className={`flex items-center ${className}`} role="separator">
      <div className="h-[1px] flex-1 bg-background-border" />
      {children && (
        <span className="text-neutral-600 whitespace-nowrap px-2 text-sm">
          {children}
        </span>
      )}
      <div className="h-[1px] flex-1 bg-background-border" />
    </div>
  );
}
