import { StaticImageData } from 'next/image';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

interface MentorCardProps {
  avatar: StaticImageData;
  years: string;
  name: string;
  position: string;
  company: string;
  personalStatment: string;
  skills: string[];
}

export const MentorCard = ({
  avatar,
  years,
  name,
  position,
  company,
  personalStatment,
  skills,
}: MentorCardProps) => {
  return (
    <article className="h-full max-h-[480px] w-full max-w-[413px] overflow-hidden rounded-lg border border-[#E6E8EA] bg-background-white">
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
};
