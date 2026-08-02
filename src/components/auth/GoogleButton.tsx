import { GoogleColor } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { useGoogleAuth } from '@/hooks/auth/useGoogleAuth';

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
  const { handleGoogleAuth, isPending } = useGoogleAuth();

  const handleGoogleSignUp = async () => {
    await handleGoogleAuth(isSignIn);
  };

  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-full"
      disabled={isSubmitting || isPending}
      onClick={handleGoogleSignUp}
    >
      <GoogleColor className="mr-3 text-xl" />
      <span className="text-base">{label}</span>
    </Button>
  );
}
