import { ReactNode } from 'react';

interface DividerProps {
  children?: ReactNode;
  className?: string;
}

export default function Divider({ children, className = '' }: DividerProps) {
  return (
    <div className={`flex items-center ${className}`} role="separator">
      <div className="bg-background-border h-px flex-1" />
      {children && (
        <span className="text-text-secondary px-2 text-sm whitespace-nowrap">
          {children}
        </span>
      )}
      <div className="bg-background-border h-px flex-1" />
    </div>
  );
}
