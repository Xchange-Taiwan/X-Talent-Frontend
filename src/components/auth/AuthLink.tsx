import Link from 'next/link';

import { linkStyle } from '@/components/auth/constants';

interface AuthLinkProps {
  prefixText?: string;
  text?: string;
  href?: string;
  className?: string;
}

export default function AuthLink({
  prefixText = '',
  text = '',
  href = '',
  className = '',
}: AuthLinkProps) {
  return (
    <p className="text-neutral-600 text-center">
      {prefixText}{' '}
      <Link href={href} className={`${linkStyle} ${className}`}>
        {text}
      </Link>
    </p>
  );
}
