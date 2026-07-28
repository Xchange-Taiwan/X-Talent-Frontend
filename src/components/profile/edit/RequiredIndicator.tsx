'use client';

import React from 'react';

interface RequiredIndicatorProps {
  show?: boolean;
}

export const RequiredIndicator = ({ show = true }: RequiredIndicatorProps) => {
  if (!show) return null;
  return (
    <span className="text-status-error-default" aria-hidden="true">
      *{' '}
    </span>
  );
};
