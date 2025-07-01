import { useRouter } from 'next/navigation';

import { GoogleColor } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface GoogleSignUpButtonProps {
  isSubmitting: boolean;
  isSignIn: boolean;
  label: string;
}

export default function GoogleSignUpButton({
  isSubmitting,
  label,
  isSignIn,
}: GoogleSignUpButtonProps) {
  const { toast } = useToast();
  const router = useRouter();

  const handleGoogleSignUp = async () => {
    try {
      const endpoint = isSignIn
        ? '/v2/oauth/google/authorize/login'
        : '/v2/oauth/google/authorize/signup';

      const url = `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const json = await res.json();

      if (res.ok && json.data?.authorization_url) {
        router.push(json.data.authorization_url);
      } else {
        throw new Error(json.msg || '無法取得授權連結');
      }
    } catch (error) {
      console.error('❌ Google SignUp Error:', error);
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 Google 註冊，請稍後再試。',
      });
    }
  };

  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-full"
      disabled={isSubmitting}
      onClick={handleGoogleSignUp}
    >
      <GoogleColor className="mr-3 text-xl" />
      <span className="text-base">{label}</span>
    </Button>
  );
}
