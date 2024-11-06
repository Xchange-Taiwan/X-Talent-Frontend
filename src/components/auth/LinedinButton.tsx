import { signIn } from 'next-auth/react';

import { LinkedinColor } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface LinkedInSignUpButtonProps {
  isSubmitting: boolean;
  label: string;
}

export default function LinkedInSignUpButton({
  isSubmitting,
  label,
}: LinkedInSignUpButtonProps) {
  const { toast } = useToast();

  const handleLinkedInSignUp = async () => {
    try {
      await signIn('linkedin');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 LinkedIn 註冊，請稍後再試。',
      });
      return;
    }
  };

  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-full"
      disabled={isSubmitting}
      onClick={handleLinkedInSignUp}
    >
      <LinkedinColor className="mr-3 text-xl" />
      <span className="text-base">{label}</span>
    </Button>
  );
}
