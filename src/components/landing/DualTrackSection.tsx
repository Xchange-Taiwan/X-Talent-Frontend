'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import {
  FIND_MENTOR_HREF,
  getMentorOnboardingUrl,
  SIGNUP_HREF,
} from '@/lib/routes';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export function DualTrackSection(): React.ReactElement {
  const identity = useResolvedIdentity();

  const isMember =
    identity.state === 'confirmed-member' && Boolean(identity.userId);
  const href = !isMember
    ? SIGNUP_HREF
    : identity.isMentor
      ? FIND_MENTOR_HREF
      : getMentorOnboardingUrl(identity.userId!);
  const ctaLabel = !isMember
    ? '加入 X-Talent'
    : identity.isMentor
      ? '探索導師池'
      : '成為導師';

  return (
    <div className="px-5 py-4 sm:px-6">
      <section
        aria-labelledby="homepage-dual-track-title"
        data-testid="homepage-dual-track"
        className="border-brand-100 from-brand-50/90 to-background-white mx-auto my-4 mb-10 flex max-w-[1096px] flex-col items-start justify-between gap-6 rounded-2xl border bg-gradient-to-br p-6 sm:mb-16 sm:flex-row sm:items-center sm:gap-7 sm:px-10 sm:py-8"
      >
        <div>
          <h2
            id="homepage-dual-track-title"
            className="text-text-primary text-xl font-semibold sm:text-2xl"
          >
            一個帳號，雙軌成長
          </h2>
          <p className="text-text-secondary mt-2.5 max-w-[700px] text-sm leading-relaxed">
            註冊後，同一個帳號就能當 Mentee，也能在右上角切換成
            Mentor。完成導師資料，即可以 L1
            導師身分開始服務，累積有效服務時數升級。
          </p>
        </div>

        <Link
          href={href}
          data-testid="homepage-cta-dual-track"
          data-analytics-click="landing_dual_track_cta"
          data-analytics-feature="landing"
          data-analytics-location="dual_track_banner"
          className={cn(
            FOCUS_RING_NO_OFFSET_CLASSES,
            'bg-brand-500 text-text-primary hover:bg-brand-600 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors'
          )}
        >
          <span>{ctaLabel}</span>
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
