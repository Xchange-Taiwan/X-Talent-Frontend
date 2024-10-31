import { Button } from '@/components/ui/button';

interface AuthButtonProps {
  isSubmitting: boolean;
  children: React.ReactNode;
}

export default function AuthButton({
  isSubmitting,
  children,
}: AuthButtonProps) {
  return (
    <Button
      className="h-12 w-full rounded-full"
      type="submit"
      disabled={isSubmitting}
    >
      {children}
    </Button>
  );
}
