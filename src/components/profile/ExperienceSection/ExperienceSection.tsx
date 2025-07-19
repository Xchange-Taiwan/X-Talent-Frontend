'use client';
import React from 'react';

import Divider from '@/components/auth/Divider';

export type ExperienceItem = {
  title: string;
  subtitle: string;
  description?: string;
  startDate: string;
  endDate: string;
};

export const ExperienceItemCard = ({
  title,
  subtitle,
  description,
  startDate,
  endDate,
}: ExperienceItem) => {
  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{subtitle}</span>
        <span className="text-xs">
          {startDate} - {endDate}
        </span>
      </div>
      <div>
        <h2 className="mb-1 text-base font-bold" style={{ color: '#49454F' }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm" style={{ color: '#49454F' }}>
            {description}
          </p>
        )}
      </div>
    </section>
  );
};

export type ExperienceSectionProps = {
  items: ExperienceItem[];
};

export const ExperienceSection = ({ items }: ExperienceSectionProps) => {
  return (
    <section className="flex flex-col gap-3">
      {items.map((item, idx) => (
        <div key={idx}>
          <ExperienceItemCard {...item} />
          {idx < items.length - 1 && <Divider />}
        </div>
      ))}
    </section>
  );
};
