'use client';

import React from 'react';

//--------------------------------------------------
// 🧩 Two‑column Section Wrapper
//--------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export const Section = ({ title, children }: SectionProps) => (
  <div className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row">
    <div className="max-w-80 grow">
      <p className="mb-4 text-xl font-bold">{title}</p>
    </div>
    <div className="grow">{children}</div>
  </div>
);
