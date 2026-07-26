'use client';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useGoogleOAuthCallback } from '@/hooks/auth/useGoogleOAuthCallback';

export default function GoogleOAuthRedirectPage() {
  const { loading } = useGoogleOAuthCallback();

  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-3">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">
        {loading ? 'Signing you in with Google...' : 'Redirecting...'}
      </p>
    </div>
  );
}
