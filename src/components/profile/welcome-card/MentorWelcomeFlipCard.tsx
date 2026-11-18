'use client';

import { RotateCw } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { Badge } from '@/components/ui/badge';
import { TotalWorkSpanEnum } from '@/constant/seniority';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import {
  resolveLocationLabel,
  splitExperienceDisplay,
} from '@/lib/mentor/mentorStats';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface MentorWelcomeFlipCardProps {
  userData: UserType;
  defaultFlipped?: boolean;
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
  className,
}: MentorWelcomeFlipCardProps) {
  const [isFlipped, setIsFlipped] = useState<boolean>(defaultFlipped);

  const avatarSrc = userData.avatar || DefaultAvatarImgUrl;
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
    .join(' · ');

  const skills = (userData.have_skill ?? []).slice(0, 6);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsFlipped((prev) => !prev);
    }
  };

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[460px] p-1 [perspective:1200px]',
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        data-testid="mentor-welcome-flip-card"
        aria-pressed={isFlipped}
        aria-label={isFlipped ? '翻回導師小卡正面' : '翻轉導師小卡查看歡迎語'}
        onClick={() => setIsFlipped((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          FOCUS_RING_NO_OFFSET_CLASSES,
          'group relative block min-h-[420px] w-full cursor-pointer rounded-3xl text-left transition-transform duration-500 [transform-style:preserve-3d]',
          isFlipped && '[transform:rotateY(180deg)]'
        )}
      >
        <div
          data-testid="mentor-card-front"
          aria-hidden={isFlipped}
          className={cn(
            'border-background-border bg-background-white flex min-h-[420px] w-full flex-col justify-between rounded-3xl border p-7 shadow-md [backface-visibility:hidden]',
            isFlipped && 'pointer-events-none'
          )}
        >
          <div>
            <div className="mb-5 flex items-center justify-between">
              <span className="bg-brand-100 text-brand-700 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase">
                MENTOR
              </span>
              <span className="text-text-tertiary group-hover:text-brand-700 inline-flex items-center gap-1 text-xs font-medium transition-colors">
                <RotateCw className="size-3.5" aria-hidden="true" />
                點卡片翻面
              </span>
            </div>

            <div className="mb-5 flex items-center gap-4">
              <div className="border-background-border relative size-16 shrink-0 overflow-hidden rounded-full border">
                <Image
                  src={avatarSrc}
                  alt={`Avatar of ${userData.name}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-text-primary truncate text-xl font-bold">
                  {userData.name}
                </h2>
                {(userData.job_title || userData.company) && (
                  <p className="text-text-secondary mt-0.5 truncate text-sm">
                    {userData.job_title}
                    {userData.job_title && userData.company
                      ? ` at ${userData.company}`
                      : ''}
                    {!userData.job_title && userData.company
                      ? userData.company
                      : ''}
                  </p>
                )}
              </div>
            </div>

            {userData.about?.trim() && (
              <p className="text-text-secondary mb-5 line-clamp-4 text-sm leading-relaxed">
                {userData.about}
              </p>
            )}

            {servicesSummary && (
              <p className="text-brand-700 mb-3 text-xs font-semibold">
                {servicesSummary}
              </p>
            )}

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, idx) => (
                  <Badge
                    key={`${skill.subject_group}-${idx}`}
                    variant="default"
                  >
                    {skill.subject}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {metaParts.length > 0 && (
            <div className="border-background-border text-text-tertiary mt-6 border-t pt-4 text-xs font-medium">
              {metaParts.join(' · ')}
            </div>
          )}
        </div>

        <div
          data-testid="mentor-card-back"
          aria-hidden={!isFlipped}
          className={cn(
            'from-brand-700 to-brand-500 text-text-white absolute inset-0 flex min-h-[420px] w-full [transform:rotateY(180deg)] flex-col justify-between rounded-3xl bg-gradient-to-br p-8 shadow-md [backface-visibility:hidden]',
            !isFlipped && 'pointer-events-none'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-text-white/80 text-xs font-bold tracking-widest uppercase">
              WELCOME TO X-TALENT
            </span>
            <span className="text-text-white/80 inline-flex items-center gap-1 text-xs font-medium">
              <RotateCw className="size-3.5" aria-hidden="true" />
              翻回正面
            </span>
          </div>

          <div className="my-8 space-y-3">
            <p className="text-2xl leading-snug font-bold sm:text-3xl">
              很高興，
              <br />
              有你一起。
            </p>
            <p className="text-text-white/90 text-base leading-relaxed">
              讓經驗成為連結，
              <br />
              陪伴下一段成長。
            </p>
          </div>

          <div className="border-background-white/20 text-text-white/80 border-t pt-4 text-xs font-semibold tracking-wide">
            X-Talent Mentor
          </div>
        </div>
      </div>
    </div>
  );
}
