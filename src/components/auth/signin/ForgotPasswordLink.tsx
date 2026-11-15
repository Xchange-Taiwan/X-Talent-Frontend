import Link from 'next/link';

import { linkStyle } from '@/components/auth/constants';
import { PASSWORD_FORGOT_HREF } from '@/lib/routes';
import { cn } from '@/lib/utils';

const ForgotPasswordLink: React.FC = () => {
  return (
    <Link href={PASSWORD_FORGOT_HREF} className={cn(linkStyle, 'inline-block')}>
      忘記密碼
    </Link>
  );
};

export default ForgotPasswordLink;
