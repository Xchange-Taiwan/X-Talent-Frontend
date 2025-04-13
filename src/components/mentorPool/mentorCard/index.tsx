import { StaticImageData } from 'next/image';
import { forwardRef } from 'react';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

export interface MentorCardProps {
  id: number;
  avatar: StaticImageData;
  years: string;
  name: string;
  position: string;
  company: string;
  personalStatment: string;
  skills: string[];
}

export const MentorCard = forwardRef<HTMLElement, MentorCardProps>(
  (
    {
      avatar,
      years,
      name,
      position,
      company,
      personalStatment,
      skills,
    }: MentorCardProps,
    ref,
  ) => {
    return (
      <article
        ref={ref}
        className="h-[534px] w-[334px] overflow-hidden rounded-lg border border-[#E6E8EA] bg-background-white xl:h-[480px] xl:w-[413px]"
      >
        <AvatarWithBadge avatar={avatar} years={years} />
        <div className="px-4 pb-6 pt-4">
          <Information
            name={name}
            position={position}
            company={company}
            personalStatment={personalStatment}
            skills={skills}
          />
        </div>
      </article>
    );
  },
);

MentorCard.displayName = 'MentorCard';
