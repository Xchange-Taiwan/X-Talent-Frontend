'use client';

import dynamic from 'next/dynamic';

import { useEmailVerify } from '@/hooks/auth/useEmailVerify';

const EmailVerificationPage = dynamic(() => import('./ui'));

export default function EmailVerificationContainer() {
  const { email, isResending, handleResendEmail, handleNavigateHome } =
    useEmailVerify();

  if (!email) {
    return null;
  }

  return (
    <EmailVerificationPage
      isResending={isResending}
      onResendEmail={handleResendEmail}
      onNavigateHome={handleNavigateHome}
    />
  );
}
