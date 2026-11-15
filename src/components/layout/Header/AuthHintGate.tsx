'use client';

import * as React from 'react';

import { type ResolvedIdentity } from '@/lib/auth/sessionHint';
import { cn } from '@/lib/utils';

export type AuthHintRole = 'guest' | 'mentee' | 'mentor';
export type AuthHintDisplay = 'block' | 'flex' | 'inline-flex';

const ALL_AUTH_ROLES: readonly AuthHintRole[] = ['guest', 'mentee', 'mentor'];

const DEFAULT_UNKNOWN_IDENTITY: ResolvedIdentity = {
  state: 'unknown',
  userId: undefined,
  avatar: undefined,
  isMentor: false,
};

const AuthHintContext = React.createContext<ResolvedIdentity>(
  DEFAULT_UNKNOWN_IDENTITY
);

export interface AuthHintProviderProps {
  identity: ResolvedIdentity;
  children: React.ReactNode;
}

/**
 * Provides the resolved or pre-hydration `ResolvedIdentity` across the Header
 * subtree so `<AuthHintGate>` and child shells can coordinate ADR-0001
 * session-hint visibility without prop-drilling CSS rules.
 */
export function AuthHintProvider({
  identity,
  children,
}: AuthHintProviderProps): JSX.Element {
  return (
    <AuthHintContext.Provider value={identity}>
      {children}
    </AuthHintContext.Provider>
  );
}

export function useAuthHintIdentity(
  overrideIdentity?: ResolvedIdentity
): ResolvedIdentity {
  const contextIdentity = React.useContext(AuthHintContext);
  return overrideIdentity ?? contextIdentity;
}

const UNHINTED_ONLY_CLASSES =
  'group-data-[auth-state=guest]/auth-state:hidden group-data-[auth-state=mentee]/auth-state:hidden group-data-[auth-state=mentor]/auth-state:hidden';

const SHOW_ROLE_CLASSES: Record<
  AuthHintDisplay,
  Record<AuthHintRole, string>
> = {
  block: {
    guest: 'group-data-[auth-state=guest]/auth-state:block',
    mentee: 'group-data-[auth-state=mentee]/auth-state:block',
    mentor: 'group-data-[auth-state=mentor]/auth-state:block',
  },
  flex: {
    guest: 'group-data-[auth-state=guest]/auth-state:flex',
    mentee: 'group-data-[auth-state=mentee]/auth-state:flex',
    mentor: 'group-data-[auth-state=mentor]/auth-state:flex',
  },
  'inline-flex': {
    guest: 'group-data-[auth-state=guest]/auth-state:inline-flex',
    mentee: 'group-data-[auth-state=mentee]/auth-state:inline-flex',
    mentor: 'group-data-[auth-state=mentor]/auth-state:inline-flex',
  },
};

const HIDE_ROLE_CLASSES: Record<AuthHintRole, string> = {
  guest: 'group-data-[auth-state=guest]/auth-state:hidden',
  mentee: 'group-data-[auth-state=mentee]/auth-state:hidden',
  mentor: 'group-data-[auth-state=mentor]/auth-state:hidden',
};

function resolveIdentityRole(identity: ResolvedIdentity): AuthHintRole | null {
  if (identity.state === 'unknown') return null;
  if (identity.state === 'confirmed-guest') return 'guest';
  return identity.isMentor ? 'mentor' : 'mentee';
}

export interface AuthHintGateProps {
  /**
   * Which ADR-0001 `data-auth-state` roles should display this subtree during
   * `identity.state === 'unknown'` (and after resolution unless
   * `onlyWhileUnknown` is set). Pass `'unhinted'` for fallback skeletons that
   * only display when no `data-auth-state` attribute is set on `<html>`.
   */
  when: readonly AuthHintRole[] | 'unhinted';
  /**
   * Optional explicit identity override for standalone tests/stories outside
   * `<AuthHintProvider>`. Defaults to reading `AuthHintContext`.
   */
  identity?: ResolvedIdentity;
  /**
   * Display utility applied by `group-data-[auth-state=...]` when
   * `defaultVisible` is false. Defaults to `'block'`.
   */
  display?: AuthHintDisplay;
  /**
   * When true, keeps the subtree visible during `unknown` unless `<html>` has
   * a `data-auth-state` role excluded from `when` (e.g. guest `HamburgerMenu`).
   */
  defaultVisible?: boolean;
  /**
   * When true, unmounts as soon as `identity.state !== 'unknown'` (used for
   * pre-hydration `--auth-avatar` and skeleton placeholders).
   */
  onlyWhileUnknown?: boolean;
  /**
   * When true, merges pre-hydration classes directly onto the single child
   * element instead of wrapping in an extra `<div>`.
   */
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function AuthHintGate({
  when,
  identity: overrideIdentity,
  display = 'block',
  defaultVisible = false,
  onlyWhileUnknown = false,
  asChild = false,
  className,
  children,
}: AuthHintGateProps): JSX.Element | null {
  const identity = useAuthHintIdentity(overrideIdentity);

  if (when === 'unhinted') {
    if (identity.state !== 'unknown') {
      return null;
    }
    const unhintedClasses = cn(UNHINTED_ONLY_CLASSES, className);
    if (asChild && React.isValidElement<{ className?: string }>(children)) {
      return React.cloneElement(children, {
        className: cn(children.props.className, unhintedClasses),
      });
    }
    return <div className={unhintedClasses}>{children}</div>;
  }

  if (identity.state !== 'unknown') {
    if (onlyWhileUnknown) {
      return null;
    }
    const resolvedRole = resolveIdentityRole(identity);
    if (!resolvedRole || !when.includes(resolvedRole)) {
      return null;
    }
    return <>{children}</>;
  }

  const preHydrationClasses = defaultVisible
    ? cn(
        ALL_AUTH_ROLES.filter((role) => !when.includes(role)).map(
          (role) => HIDE_ROLE_CLASSES[role]
        ),
        className
      )
    : cn(
        'hidden',
        when.map((role) => SHOW_ROLE_CLASSES[display][role]),
        className
      );

  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: cn(children.props.className, preHydrationClasses),
    });
  }

  return <div className={preHydrationClasses}>{children}</div>;
}
