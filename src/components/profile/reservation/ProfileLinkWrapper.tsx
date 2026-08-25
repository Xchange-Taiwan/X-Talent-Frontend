import Link from 'next/link';
import React from 'react';

interface ProfileLinkWrapperProps {
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ProfileLinkWrapper({
  href,
  onClick,
  onKeyDown,
  className,
  ariaLabel,
  disabled = false,
  children,
}: ProfileLinkWrapperProps) {
  if (!href) {
    const cleanClassName = className
      ? className
          .split(' ')
          .filter(
            (c) => !c.includes('pointer-events-') && !c.includes('hover:')
          )
          .join(' ')
      : undefined;

    return (
      <span className={cleanClassName} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
