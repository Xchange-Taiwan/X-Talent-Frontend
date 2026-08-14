import Link from 'next/link';

import { Button } from '@/components/ui/button';

export interface GuestActionButtonsProps {
  /**
   * Wraps the buttons in a `<div>` with this className. Used by the
   * pre-hydration CSS fast path (see Header.tsx), which needs its own
   * flex/gap container that toggles as a unit on `data-auth-state=guest`.
   * Omit to render the buttons directly, unwrapped.
   */
  wrapperClassName?: string;
}

/**
 * The desktop header's guest sign-up/sign-in buttons. Rendered twice in
 * Header.tsx: once CSS-gated for the pre-hydration guest fast path, and
 * once for the fully resolved `!isLoggedIn` state.
 */
export function GuestActionButtons({
  wrapperClassName,
}: GuestActionButtonsProps): JSX.Element {
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

  if (!wrapperClassName) {
    return buttons;
  }

  return <div className={wrapperClassName}>{buttons}</div>;
}
