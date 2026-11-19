'use client';

import { MapPin, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import LogoImgUrl from '@/assets/logo.svg';
import { TotalWorkSpanEnum } from '@/constant/seniority';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { resolveAvatarDisplayUrl } from '@/lib/avatar/avatarUrl';
import {
  resolveLocationLabel,
  splitExperienceDisplay,
} from '@/lib/mentor/mentorStats';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface MentorWelcomeFlipCardProps {
  userData: UserType;
  defaultFlipped?: boolean;
  onEditProfile?: () => void;
  className?: string;
}

const LEGACY_SPAN_MAP: Readonly<Record<string, string>> = {
  ...TotalWorkSpanEnum,
  ONE_TO_THREE_YEARS: TotalWorkSpanEnum.ONE_TO_THREE,
  THREE_TO_FIVE_YEARS: TotalWorkSpanEnum.THREE_TO_FIVE,
  FIVE_TO_TEN_YEARS: TotalWorkSpanEnum.FIVE_TO_TEN,
  OVER_TEN_YEARS: TotalWorkSpanEnum.OVER_TEN_YEAR,
};

export function MentorWelcomeFlipCard({
  userData,
  defaultFlipped = false,
  onEditProfile,
  className,
}: MentorWelcomeFlipCardProps) {
  const [isFlipped, setIsFlipped] = useState<boolean>(defaultFlipped);

  const avatarSrc =
    resolveAvatarDisplayUrl(userData.avatar) || DefaultAvatarImgUrl;
  const resolvedLocation =
    userData.location?.trim() ||
    resolveLocationLabel(
      userData.workExperiences?.find((e) => e.is_primary)?.job_location ||
        userData.workExperiences?.[0]?.job_location,
      'zh_TW'
    ) ||
    '';

  const servicesSummary = (userData.have_topic ?? [])
    .map((item) => item.subject)
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');

  const skills = (userData.have_skill ?? []).slice(0, 3);
  const rawYears = userData.years_of_experience?.trim() ?? '';
  const localizedYears = Object.hasOwn(LEGACY_SPAN_MAP, rawYears)
    ? LEGACY_SPAN_MAP[rawYears]
    : rawYears;
  const expParts = splitExperienceDisplay(localizedYears);
  const formattedExp =
    expParts.primary && expParts.primary !== '—'
      ? `${expParts.primary}${expParts.unit ? ` ${expParts.unit}` : ''}經驗`
      : '';
  const metaParts = [resolvedLocation, formattedExp].filter(Boolean);

  const roleLine =
    userData.job_title && userData.company
      ? `${userData.job_title}\nat ${userData.company}`
      : userData.job_title || userData.company || '';

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[333px] p-1 [perspective:1200px]',
        className
      )}
    >
      <div
        className={cn(
          'group relative block min-h-[488px] w-full rounded-3xl text-left transition-transform duration-500 [transform-style:preserve-3d]',
          isFlipped && '[transform:rotateY(180deg)]'
        )}
      >
        <button
          type="button"
          data-testid="mentor-welcome-flip-card"
          aria-pressed={isFlipped}
          aria-label={isFlipped ? '翻回導師小卡正面' : '翻轉導師小卡查看歡迎語'}
          onClick={() => setIsFlipped((prev) => !prev)}
          className={cn(
            FOCUS_RING_NO_OFFSET_CLASSES,
            'absolute inset-0 z-10 cursor-pointer rounded-3xl bg-transparent'
          )}
        />

        <div
          data-testid="mentor-card-front"
          aria-hidden={isFlipped}
          className={cn(
            'border-background-border bg-background-white pointer-events-none flex min-h-[476px] w-full flex-col justify-between overflow-hidden rounded-3xl border shadow-lg [backface-visibility:hidden]'
          )}
        >
          <div>
            <div className="from-auth-gradient-1 via-auth-gradient-2/60 to-auth-gradient-3 relative flex h-28 items-start justify-between bg-gradient-to-br px-6 pt-5">
              <Image
                src={LogoImgUrl}
                alt="X-Talent"
                width={92}
                height={18}
                className="h-[18px] w-auto"
              />
              <span className="bg-background-white/90 text-text-primary text-11 inline-flex items-center rounded-full px-3 py-1 font-bold tracking-wider uppercase shadow-xs">
                MENTOR
              </span>
            </div>

            <div className="border-background-white bg-background-white relative mx-auto -mt-11 size-[84px] overflow-hidden rounded-full border-4 shadow-sm">
              <Image
                src={avatarSrc}
                alt={`Avatar of ${userData.name}`}
                fill
                sizes="84px"
                className="object-cover"
              />
            </div>

            <div className="px-6 pt-3 pb-5 text-center">
              <h2 className="text-text-primary truncate text-2xl font-bold">
                {userData.name}
              </h2>

              {roleLine && (
                <p className="text-text-secondary mt-1.5 text-xs leading-relaxed font-medium whitespace-pre-line">
                  {roleLine}
                </p>
              )}

              {userData.about?.trim() && (
                <p className="text-text-secondary mt-4 line-clamp-2 text-left text-xs leading-relaxed">
                  {userData.about}
                </p>
              )}

              {servicesSummary && (
                <p className="text-brand-700 mt-4 text-xs font-semibold">
                  {servicesSummary}
                </p>
              )}

              {skills.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {skills.map((skill, idx) => (
                    <span
                      key={`${skill.subject_group}-${idx}`}
                      className="bg-brand-50 text-brand-700 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {skill.subject}
                    </span>
                  ))}
                </div>
              )}

              {metaParts.length > 0 && (
                <div className="text-text-tertiary mt-4 inline-flex items-center justify-center gap-1.5 text-xs font-medium">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{metaParts.join(' · ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-background-border border-t px-6 py-3.5 text-center">
            {onEditProfile ? (
              <button
                type="button"
                tabIndex={isFlipped ? -1 : 0}
                disabled={isFlipped}
                onClick={() => {
                  if (!isFlipped) onEditProfile();
                }}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'text-brand-700 hover:text-brand-500 relative z-20 inline-block cursor-pointer rounded-sm px-2 py-0.5 text-xs font-semibold transition-colors',
                  !isFlipped && 'pointer-events-auto'
                )}
              >
                編輯資料
              </button>
            ) : (
              <span className="text-brand-700 text-xs font-semibold">
                點卡片翻面
              </span>
            )}
          </div>
        </div>

        <div
          data-testid="mentor-card-back"
          aria-hidden={!isFlipped}
          className="from-brand-800 via-brand-900 to-brand-900 text-text-white pointer-events-none absolute inset-0 flex min-h-[476px] w-full [transform:rotateY(180deg)] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-7 shadow-lg [backface-visibility:hidden]"
        >
          <div
            aria-hidden="true"
            className="border-background-white/10 pointer-events-none absolute top-1/2 -right-24 size-[340px] -translate-y-1/2 rounded-full border-[22px]"
          />
          <div
            aria-hidden="true"
            className="border-background-white/5 pointer-events-none absolute top-1/2 -right-14 size-[236px] -translate-y-1/2 rounded-full border-[14px]"
          />

          <div className="relative z-10 flex items-center justify-between">
            <Image
              src={LogoImgUrl}
              alt="X-Talent"
              width={96}
              height={19}
              className="h-[19px] w-auto brightness-0 invert"
            />
          </div>

          <div className="relative z-10 my-6 space-y-3">
            <p className="text-brand-200/80 text-11 font-semibold tracking-widest uppercase">
              WELCOME TO X-TALENT
            </p>
            <p className="sm:text-28 text-2xl leading-snug font-bold">
              很高興，
              <br />
              有你一起。
            </p>
            <p className="text-text-white/80 pt-1 text-sm leading-relaxed">
              讓經驗成為連結，
              <br />
              陪伴下一段成長。
            </p>
          </div>

          <div className="border-background-white/15 relative z-10 flex items-center justify-between border-t pt-4">
            <span className="text-text-white/85 text-xs font-medium tracking-wide">
              X-Talent Mentor
            </span>
            <RotateCcw
              className="text-text-white/75 size-4 shrink-0"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
