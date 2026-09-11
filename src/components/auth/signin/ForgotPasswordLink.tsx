import Link from 'next/link';

import { linkStyle } from '@/components/auth/constants';
import { cn } from '@/lib/utils';

const ForgotPasswordLink: React.FC = () => {
  return (
    <Link
      href="/auth/password-forgot"
      className={cn(linkStyle, 'inline-block')}
    >
      忘記密碼
    </Link>
  );
};

export default ForgotPasswordLink;
