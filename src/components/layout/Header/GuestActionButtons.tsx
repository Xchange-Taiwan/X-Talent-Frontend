import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ResolvedIdentity } from '@/lib/auth/sessionHint';

export type GuestActionButtonsProps = {
  identity: ResolvedIdentity;
};

/**
 * The desktop header's guest sign-up/sign-in buttons. Rendered twice in
 * Header.tsx: once inside a CSS-gated wrapper for the pre-hydration guest
 * fast path, and once unwrapped for the fully resolved `!isLoggedIn` state.
 * Layout/wrapping is the caller's responsibility, not this component's.
 */
export function GuestActionButtons({
  identity,
}: GuestActionButtonsProps): JSX.Element | null {
  if (identity.state === 'hint-only' || identity.state === 'confirmed-member') {
    return null;
  }

  const buttons = (
    <>
      <Button
        asChild
        variant="outline"
        className="border-brand-500 text-brand-500 hover:text-brand-500"
      >
        <Link href="/auth/signup">註冊</Link>
      </Button>
      <Button asChild className="bg-brand-500 hover:bg-brand-500">
        <Link href="/auth/signin">登入</Link>
      </Button>
    </>
  );

  if (identity.state === 'unknown') {
    return (
      <div className="hidden items-center gap-3 group-data-[auth-state=guest]/auth-state:flex">
        {buttons}
      </div>
    );
  }

  return <>{buttons}</>;
}
