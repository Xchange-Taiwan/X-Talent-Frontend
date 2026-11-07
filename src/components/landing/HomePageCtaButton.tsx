'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { memo, type MouseEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { trackEvent } from '@/lib/analytics';
import { ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  FIND_MENTOR_HREF,
  getBecomeMentorHref,
  getOpenScheduleHref,
  SIGNUP_HREF,
} from '@/lib/routes';
import { cn } from '@/lib/utils';

export { SIGNUP_HREF };
export const HOMEPAGE_CTA_CLICK_EVENT = 'homepage_cta_click';

export type HomePageCtaVariant = 'hero' | 'role' | 'closing';

export interface ResolvedHomePageCta {
  label: string;
  href: string;
  disabled: boolean;
}

export function resolveHomePageCta(
  variant: HomePageCtaVariant,
  identity: ResolvedIdentity
): ResolvedHomePageCta {
  const isMember =
    identity.state === 'confirmed-member' || identity.state === 'hint-only';

  if (variant !== 'role') {
    return {
      label: isMember ? '尋找導師' : '加入 X-Talent',
      href: isMember ? FIND_MENTOR_HREF : SIGNUP_HREF,
      disabled: false,
    };
  }

  if (!isMember) {
    return { label: '成為 Mentor/Mentee', href: SIGNUP_HREF, disabled: false };
  }

  const disabled = identity.state === 'hint-only';
  return identity.isMentor
    ? {
        label: '開放預約時段',
        href: getOpenScheduleHref(identity.userId),
        disabled,
      }
    : {
        label: '成為 Mentor',
        href: getBecomeMentorHref(identity.userId),
        disabled,
      };
}

const BUTTON_CLASS_BY_VARIANT: Record<HomePageCtaVariant, string> = {
  hero: 'group h-14 min-w-[240px] gap-3 rounded-md px-9 py-3 text-base font-medium tracking-[0.04em]',
  role: 'group border-brand-600 text-brand-700 min-h-11 w-full max-w-[342px] gap-3 rounded-md px-8 py-2.5 text-sm font-medium tracking-[0.04em] sm:w-auto sm:min-w-[252px]',
  closing:
    'group min-h-11 w-full max-w-[342px] gap-3 rounded-md px-8 py-2.5 text-sm font-medium tracking-[0.04em] sm:w-auto sm:min-w-[199px]',
};

const SKELETON_CLASS_BY_VARIANT: Record<HomePageCtaVariant, string> = {
  hero: 'h-14 w-[240px] rounded-md',
  role: 'h-11 w-full max-w-[342px] rounded-md sm:w-[252px]',
  closing: 'h-11 w-full max-w-[342px] rounded-md sm:w-[199px]',
};

const UNKNOWN_SKELETON_VISIBILITY =
  'group-data-[auth-state=guest]/auth-state:hidden group-data-[auth-state=mentee]/auth-state:hidden group-data-[auth-state=mentor]/auth-state:hidden';

const UNKNOWN_PRIMARY_ITEMS = [
  [
    '加入 X-Talent',
    SIGNUP_HREF,
    false,
    'hidden group-data-[auth-state=guest]/auth-state:inline-flex',
  ],
  [
    '尋找導師',
    FIND_MENTOR_HREF,
    false,
    'hidden group-data-[auth-state=mentee]/auth-state:inline-flex group-data-[auth-state=mentor]/auth-state:inline-flex',
  ],
] as const;

const UNKNOWN_ROLE_ITEMS = [
  [
    '成為 Mentor/Mentee',
    SIGNUP_HREF,
    false,
    'hidden group-data-[auth-state=guest]/auth-state:inline-flex',
  ],
  [
    '成為 Mentor',
    getBecomeMentorHref(undefined),
    true,
    'hidden group-data-[auth-state=mentee]/auth-state:inline-flex',
  ],
  [
    '開放預約時段',
    getOpenScheduleHref(undefined),
    true,
    'hidden group-data-[auth-state=mentor]/auth-state:inline-flex',
  ],
] as const;

export interface HomePageCtaButtonProps {
  variant: HomePageCtaVariant;
  className?: string;
}

function CtaLinkItem({
  variant,
  label,
  href,
  disabled = false,
  testId,
  className,
}: {
  variant: HomePageCtaVariant;
  label: string;
  href: string;
  disabled?: boolean;
  testId?: string;
  className?: string;
}): JSX.Element {
  const dataCta = variant === 'role' ? 'shared' : variant;
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    trackEvent({
      name: HOMEPAGE_CTA_CLICK_EVENT,
      metadata: { cta: dataCta, variant, label },
    });
  };

  return (
    <Button
      asChild
      variant={variant === 'role' ? 'outline' : 'default'}
      className={cn(
        BUTTON_CLASS_BY_VARIANT[variant],
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      <Link
        href={disabled ? '#' : href}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        data-testid={testId}
        data-cta={dataCta}
        onClick={handleClick}
      >
        <span>{label}</span>
        <ArrowRight
          className={cn(
            variant === 'hero' ? 'size-5' : 'size-4',
            'shrink-0 transition-transform duration-200 group-hover:translate-x-0.5'
          )}
          aria-hidden="true"
        />
      </Link>
    </Button>
  );
}

function HomePageCtaButtonComponent({
  variant,
  className,
}: HomePageCtaButtonProps): JSX.Element {
  const identity = useResolvedIdentity();

  if (identity.state === 'unknown') {
    const items =
      variant === 'role' ? UNKNOWN_ROLE_ITEMS : UNKNOWN_PRIMARY_ITEMS;
    return (
      <>
        <Skeleton
          className={cn(
            SKELETON_CLASS_BY_VARIANT[variant],
            UNKNOWN_SKELETON_VISIBILITY
          )}
        />
        {items.map(([label, href, disabled, gateClass]) => (
          <CtaLinkItem
            key={label}
            variant={variant}
            label={label}
            href={href}
            disabled={disabled}
            className={cn(gateClass, className)}
          />
        ))}
      </>
    );
  }

  const resolved = resolveHomePageCta(variant, identity);

  return (
    <CtaLinkItem
      variant={variant}
      label={resolved.label}
      href={resolved.href}
      disabled={resolved.disabled}
      testId={`homepage-cta-${variant}`}
      className={className}
    />
  );
}

export const HomePageCtaButton = memo(HomePageCtaButtonComponent);
