import { StaticImageData } from 'next/image';
import Link from 'next/link';
import { forwardRef, memo } from 'react';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

export interface MentorCardProps {
  id: number;
  avatar: string | StaticImageData;
  years: string;
  name: string;
  job_title: string;
  company: string;
  about: string;
  haveTopicLabels: string[];
  priority?: boolean;
}

const MentorCardBase = forwardRef<HTMLElement, MentorCardProps>(
  (
    {
      id,
      avatar,
      years,
      name,
      job_title,
      company,
      about,
      haveTopicLabels,
      priority = false,
    }: MentorCardProps,
    ref
  ) => {
    return (
      <article
        ref={ref}
        className="border-background-border bg-background-white relative w-[334px] overflow-hidden rounded-lg border transition-shadow hover:shadow-xl xl:h-[480px] xl:w-[413px]"
      >
        <Link
          href={`/profile/${id}`}
          aria-label={`前往 ${name} 的個人頁面`}
          className="absolute inset-0 z-10"
        ></Link>
        <AvatarWithBadge
          avatar={avatar}
          years={years}
          name={name}
          priority={priority}
        />
        <div className="px-4 pt-4 pb-6">
          <Information
            name={name}
            job_title={job_title}
            company={company}
            about={about}
            haveTopicLabels={haveTopicLabels}
          />
        </div>
      </article>
    );
  }
);

MentorCardBase.displayName = 'MentorCard';

export const MentorCard = memo(MentorCardBase);
