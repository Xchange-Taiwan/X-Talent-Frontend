import { StaticImageData } from 'next/image';
import Link from 'next/link';
import { forwardRef, memo } from 'react';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

export interface MentorCardProps {
  id: number;
  avatar: string | StaticImageData;
  avatarVersion?: number | null;
  years: string;
  name: string;
  job_title: string;
  company: string;
  personalStatment: string;
  whatIOffers: string[];
}

const MentorCardBase = forwardRef<HTMLElement, MentorCardProps>(
  (
    {
      id,
      avatar,
      avatarVersion,
      years,
      name,
      job_title,
      company,
      personalStatment,
      whatIOffers,
    }: MentorCardProps,
    ref
  ) => {
    return (
      <article
        ref={ref}
        className="relative w-[334px] overflow-hidden rounded-lg border border-[#E6E8EA] bg-background-white transition-shadow hover:shadow-xl xl:h-[480px] xl:w-[413px]"
      >
        <Link
          href={`/profile/${id}`}
          aria-label={`前往 ${name} 的個人頁面`}
          className="absolute bottom-0 left-0 right-0 top-0 z-10"
        ></Link>
        <AvatarWithBadge
          avatar={avatar}
          avatarVersion={avatarVersion}
          years={years}
          name={name}
        />
        <div className="px-4 pb-6 pt-4">
          <Information
            name={name}
            job_title={job_title}
            company={company}
            personalStatment={personalStatment}
            whatIOffers={whatIOffers}
          />
        </div>
      </article>
    );
  }
);

MentorCardBase.displayName = 'MentorCard';

export const MentorCard = memo(MentorCardBase);
