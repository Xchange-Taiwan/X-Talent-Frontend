import { Loader2 } from 'lucide-react';

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
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
