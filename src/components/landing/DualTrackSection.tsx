'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { isDualTrackV2Enabled } from '@/lib/featureFlags';
import {
  FIND_MENTOR_HREF,
  getBecomeMentorHref,
  SIGNUP_HREF,
} from '@/lib/routes';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface ResolvedDualTrackCta {
  label: string;
  href: string;
  disabled: boolean;
}

export function resolveDualTrackCta(
  identity: ResolvedIdentity
): ResolvedDualTrackCta {
  const isMember =
    identity.state === 'confirmed-member' || identity.state === 'hint-only';

  if (!isMember) {
    return {
      label: '加入 X-Talent',
      href: SIGNUP_HREF,
      disabled: false,
    };
  }

  if (identity.isMentor) {
    return {
      label: '探索導師池',
      href: FIND_MENTOR_HREF,
      disabled: false,
    };
  }

  const disabled = identity.state === 'hint-only' || !identity.userId;
  return {
    label: '成為導師',
    href: getBecomeMentorHref(identity.userId),
    disabled,
  };
}

export interface DualTrackSectionProps {
  forceVisible?: boolean;
}

export function DualTrackSection({
  forceVisible = false,
}: DualTrackSectionProps = {}): React.ReactElement | null {
  const identity = useResolvedIdentity();
  if (!forceVisible && !isDualTrackV2Enabled()) {
    return null;
  }
  const isUnknown = identity.state === 'unknown';
  const resolved = isUnknown ? null : resolveDualTrackCta(identity);

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

        {isUnknown || !resolved ? (
          <Skeleton
            data-testid="homepage-cta-dual-track-skeleton"
            className="h-11 w-[140px] shrink-0 rounded-lg"
          />
        ) : (
          <Link
            href={resolved.disabled ? '#' : resolved.href}
            aria-disabled={resolved.disabled}
            tabIndex={resolved.disabled ? -1 : undefined}
            onClick={(e) => {
              if (resolved.disabled) {
                e.preventDefault();
              }
            }}
            data-testid="homepage-cta-dual-track"
            data-analytics-click="landing_dual_track_cta"
            data-analytics-feature="landing"
            data-analytics-location="dual_track_banner"
            className={cn(
              FOCUS_RING_NO_OFFSET_CLASSES,
              'bg-brand-500 text-text-primary hover:bg-brand-600 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors',
              resolved.disabled && 'pointer-events-none opacity-50'
            )}
          >
            <span>{resolved.label}</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </section>
    </div>
  );
}
