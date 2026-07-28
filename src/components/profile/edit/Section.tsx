import React from 'react';

import { RequiredIndicator } from './RequiredIndicator';

//--------------------------------------------------
// 🧩 Two‑column Section Wrapper
//--------------------------------------------------

interface SectionProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  id?: string;
  required?: boolean;
}

export const Section = ({
  title,
  children,
  id,
  required = false,
}: SectionProps) => (
  <div
    id={id}
    className="flex flex-col border-t-2 border-solid border-background-border pt-10 lg:flex-row"
  >
    <div className="max-w-80 grow">
      <p className="mb-4 text-xl font-bold">
        <RequiredIndicator show={required} />
        {title}
      </p>
    </div>
    <div className="grow">{children}</div>
  </div>
);
