import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * The desktop header's guest sign-up/sign-in buttons. Rendered twice in
 * Header.tsx: once inside a CSS-gated wrapper for the pre-hydration guest
 * fast path, and once unwrapped for the fully resolved `!isLoggedIn` state.
 * Layout/wrapping is the caller's responsibility, not this component's.
 */
export function GuestActionButtons(): JSX.Element {
  return (
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
}
