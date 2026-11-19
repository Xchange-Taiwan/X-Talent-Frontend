'use client';

import Image from 'next/image';
import type { FC } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { resolveDisplaySocialLinks } from '@/components/profile/social-links/platformLabelMap';
import { shouldUnoptimizeAvatarSrc } from '@/lib/avatar/avatarUrl';
import type { PersonalLink } from '@/lib/profile/socialLinks';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  name: string;
  avatarImgUrl?: string;
  personalLinks?: PersonalLink[];
  jobTitle?: string;
  companyName?: string;
}

export const AvatarCard: FC<Props> = ({
  className,
  name,
  avatarImgUrl,
  personalLinks,
  jobTitle,
  companyName,
}) => {
  const safePersonalLinks = resolveDisplaySocialLinks(personalLinks);
  const trimmedJob = jobTitle?.trim() ?? '';
  const trimmedCompany = companyName?.trim() ?? '';

  return (
    <div
      data-clarity-mask="true"
      className={cn('flex flex-col items-center gap-6 sm:flex-row', className)}
    >
      <div className="bg-background-white relative h-[120px] w-[120px] flex-shrink-0 overflow-hidden rounded-full">
        <Image
          src={avatarImgUrl || DefaultAvatarImgUrl}
          alt={'Avatar of ' + name}
          fill
          sizes="120px"
          unoptimized={shouldUnoptimizeAvatarSrc(avatarImgUrl)}
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <h1 className="text-base font-bold sm:text-2xl">{name}</h1>

          {safePersonalLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {safePersonalLinks.map((item, index) => (
                <a
                  key={`${item.platform}-${index}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="inline-flex shrink-0 items-center"
                >
                  {item.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        {(trimmedJob || trimmedCompany) && (
          <p className="text-sm">
            {trimmedJob}
            {Boolean(trimmedCompany) && (
              <>
                {trimmedJob ? ' ' : ''}
                <span className="text-text-tertiary">at</span> {trimmedCompany}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
};
