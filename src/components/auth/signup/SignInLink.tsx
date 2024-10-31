import Link from 'next/link';
import React from 'react';

import { linkStyle } from '@/components/auth/constants';

export default function SignInLink() {
  return (
    <p className="text-neutral-600 text-center">
      已經有帳號了?{' '}
      <Link href="/auth/signin" className={linkStyle}>
        登入X-Talent
      </Link>
    </p>
  );
}
