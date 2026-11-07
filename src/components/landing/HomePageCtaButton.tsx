'use client';

import { ArrowRight } from 'lucide-react';
import { memo } from 'react';

import { FIND_MENTOR_HREF } from '@/components/layout/Header/constants';
import { DisabledAwareLink } from '@/components/layout/Header/DisabledAwareLink';
import {
  getBecomeMentorHref,
  getOpenScheduleHref,
} from '@/components/layout/Header/navHrefs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { cn } from '@/lib/utils';

export const SIGNUP_HREF = '/auth/signup';

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
  if (variant === 'hero' || variant === 'closing') {
    if (
      identity.state === 'confirmed-member' ||
      identity.state === 'hint-only'
    ) {
      return {
        label: '尋找導師',
        href: FIND_MENTOR_HREF,
        disabled: false,
      };
    }

    return {
      label: '加入 X-Talent',
      href: SIGNUP_HREF,
      disabled: false,
    };
  }

  if (identity.state === 'confirmed-member') {
    if (identity.isMentor) {
      return {
        label: '開放預約時段',
        href: getOpenScheduleHref(identity.userId),
        disabled: false,
      };
    }

    return {
      label: '成為 Mentor',
      href: getBecomeMentorHref(identity.userId),
      disabled: false,
    };
  }

  if (identity.state === 'hint-only') {
    if (identity.isMentor) {
      return {
        label: '開放預約時段',
        href: getOpenScheduleHref(identity.userId),
        disabled: true,
      };
    }

    return {
      label: '成為 Mentor',
      href: getBecomeMentorHref(identity.userId),
      disabled: true,
    };
  }

  return {
    label: '成為 Mentor/Mentee',
    href: SIGNUP_HREF,
    disabled: false,
  };
}

function getButtonClassName(variant: HomePageCtaVariant): string {
  if (variant === 'hero') {
    return 'group h-14 min-w-[240px] gap-3 rounded-md px-9 py-3 text-base font-medium tracking-[0.04em]';
  }

  if (variant === 'role') {
    return 'group border-brand-600 text-brand-700 min-h-11 w-full max-w-[342px] gap-3 rounded-md px-8 py-2.5 text-sm font-medium tracking-[0.04em] sm:w-auto sm:min-w-[252px]';
  }

  return 'group min-h-11 w-full max-w-[342px] gap-3 rounded-md px-8 py-2.5 text-sm font-medium tracking-[0.04em] sm:w-auto sm:min-w-[199px]';
}

function getSkeletonClassName(variant: HomePageCtaVariant): string {
  if (variant === 'hero') {
    return 'h-14 w-[240px] rounded-md';
  }

  if (variant === 'role') {
    return 'h-11 w-full max-w-[342px] rounded-md sm:w-[252px]';
  }

  return 'h-11 w-full max-w-[342px] rounded-md sm:w-[199px]';
}

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
  const buttonVariant = variant === 'role' ? 'outline' : 'default';
  const dataCta = variant === 'role' ? 'shared' : variant;
  const iconClassName =
    variant === 'hero'
      ? 'size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5'
      : 'size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5';

  return (
    <Button
      asChild
      variant={buttonVariant}
      className={cn(getButtonClassName(variant), className)}
    >
      <DisabledAwareLink
        href={href}
        disabled={disabled}
        data-testid={testId}
        data-cta={dataCta}
      >
        <span>{label}</span>
        <ArrowRight className={iconClassName} aria-hidden="true" />
      </DisabledAwareLink>
    </Button>
  );
}

function HomePageCtaButtonComponent({
  variant,
  className,
}: HomePageCtaButtonProps): JSX.Element {
  const identity = useResolvedIdentity();

  if (identity.state === 'unknown') {
    const skeletonVisibility =
      'group-data-[auth-state=guest]/auth-state:hidden group-data-[auth-state=mentee]/auth-state:hidden group-data-[auth-state=mentor]/auth-state:hidden';

    if (variant === 'hero' || variant === 'closing') {
      return (
        <>
          <Skeleton
            className={cn(getSkeletonClassName(variant), skeletonVisibility)}
          />
          <CtaLinkItem
            variant={variant}
            label="加入 X-Talent"
            href={SIGNUP_HREF}
            className={cn(
              'hidden group-data-[auth-state=guest]/auth-state:inline-flex',
              className
            )}
          />
          <CtaLinkItem
            variant={variant}
            label="尋找導師"
            href={FIND_MENTOR_HREF}
            className={cn(
              'hidden group-data-[auth-state=mentee]/auth-state:inline-flex group-data-[auth-state=mentor]/auth-state:inline-flex',
              className
            )}
          />
        </>
      );
    }

    return (
      <>
        <Skeleton
          className={cn(getSkeletonClassName(variant), skeletonVisibility)}
        />
        <CtaLinkItem
          variant="role"
          label="成為 Mentor/Mentee"
          href={SIGNUP_HREF}
          className={cn(
            'hidden group-data-[auth-state=guest]/auth-state:inline-flex',
            className
          )}
        />
        <CtaLinkItem
          variant="role"
          label="成為 Mentor"
          href={getBecomeMentorHref(undefined)}
          disabled={true}
          className={cn(
            'hidden group-data-[auth-state=mentee]/auth-state:inline-flex',
            className
          )}
        />
        <CtaLinkItem
          variant="role"
          label="開放預約時段"
          href={getOpenScheduleHref(undefined)}
          disabled={true}
          className={cn(
            'hidden group-data-[auth-state=mentor]/auth-state:inline-flex',
            className
          )}
        />
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
