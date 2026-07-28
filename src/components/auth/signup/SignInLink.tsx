import Link from 'next/link';
import React from 'react';

import { linkStyle } from '@/components/auth/constants';

export default function SignInLink() {
  return (
    <p className="text-center text-text-secondary">
      已經有帳號了?{' '}
      <Link href="/auth/signin" className={linkStyle}>
        登入X-Talent
      </Link>
    </p>
  );
}
