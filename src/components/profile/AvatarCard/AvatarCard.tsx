import Image from 'next/image';
import type { FC } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.jpeg';
import { LinkedinColor } from '@/components/Icon';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  name: string;
  avatarImgUrl?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  companyName?: string;
}

export const AvatarCard: FC<Props> = ({
  className,
  name,
  avatarImgUrl,
  linkedinUrl,
  jobTitle,
  companyName,
}) => {
  const handleNavigateToLinkedin = (linkedinUrl: string) => {
    window.open(linkedinUrl, '_blank');
  };

  return (
    <div
      className={cn('flex flex-col items-center gap-6 sm:flex-row', className)}
    >
      <div className="relative h-[120px] w-[120px] flex-shrink-0 overflow-hidden rounded-full bg-background-white">
        <Image
          src={avatarImgUrl || DefaultAvatarImgUrl}
          alt={'Avatar of ' + name}
          fill
          style={{
            objectFit: 'contain',
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <h1 className="text-base font-bold sm:text-2xl">{name}</h1>

          {!!linkedinUrl && (
            <LinkedinColor
              className="h-5 w-5 cursor-pointer sm:h-6 sm:w-6"
              onClick={() => handleNavigateToLinkedin(linkedinUrl)}
            />
          )}
        </div>

        <p className="text-sm">
          {jobTitle}

          {!!companyName && (
            <>
              {' '}
              <span className="text-text-tertiary">at</span> {companyName}
            </>
          )}
        </p>
      </div>
    </div>
  );
};
