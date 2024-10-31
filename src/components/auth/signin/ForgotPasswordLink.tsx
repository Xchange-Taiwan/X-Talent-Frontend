import { useRouter } from 'next/navigation';

import { linkStyle } from '@/components/auth/constants';
import { FormDescription } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const ForgotPasswordLink: React.FC = () => {
  const router = useRouter();

  return (
    <FormDescription
      className={cn(linkStyle, 'inline-block')}
      onClick={() => router.push('/auth/passwordForget')}
    >
      忘記密碼
    </FormDescription>
  );
};

export default ForgotPasswordLink;
