import { StaticImageData } from 'next/image';
import Link from 'next/link';
import { forwardRef } from 'react';

import { InterestType } from '@/services/searchMentor/mentors';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

export interface MentorCardProps {
  id: number;
  avatar: string | StaticImageData;
  years: string;
  name: string;
  job_title: string;
  company: string;
  personalStatment: string;
  skills: {
    interests: InterestType[];
    language: string | null;
  };
}

export const MentorCard = forwardRef<HTMLElement, MentorCardProps>(
  (
    {
      avatar,
      years,
      name,
      job_title,
      company,
      personalStatment,
      skills,
    }: MentorCardProps,
    ref,
  ) => {
    return (
      <article
        ref={ref}
        className=" relative h-[534px] w-[334px] overflow-hidden rounded-lg border border-[#E6E8EA] bg-background-white transition-shadow hover:shadow-xl xl:h-[480px] xl:w-[413px]"
      >
        <Link
          href=""
          className="absolute bottom-0 left-0 right-0 top-0 z-10"
        ></Link>
        <AvatarWithBadge avatar={avatar} years={years} />
        <div className="px-4 pb-6 pt-4">
          <Information
            name={name}
            job_title={job_title}
            company={company}
            personalStatment={personalStatment}
            skills={skills.interests}
          />
        </div>
      </article>
    );
  },
);

MentorCard.displayName = 'MentorCard';
