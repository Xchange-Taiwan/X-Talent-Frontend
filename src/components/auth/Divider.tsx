import { ReactNode } from 'react';

interface DividerProps {
  children?: ReactNode;
  className?: string;
}

export default function Divider({ children, className = '' }: DividerProps) {
  return (
    <div className={`flex items-center ${className}`} role="separator">
      <div className="h-px flex-1 bg-background-border" />
      {children && (
        <span className="whitespace-nowrap px-2 text-sm text-text-secondary">
          {children}
        </span>
      )}
      <div className="h-px flex-1 bg-background-border" />
    </div>
  );
}
