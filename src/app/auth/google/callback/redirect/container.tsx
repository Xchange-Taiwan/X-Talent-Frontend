'use client';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useGoogleOAuthCallback } from '@/hooks/auth/useGoogleOAuthCallback';
import type { PreExchangedGoogleOAuthResult } from '@/lib/auth/sessionLifecycle';

export function GoogleOAuthRedirectShell({
  loading = true,
}: {
  loading?: boolean;
}) {
  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-3">
      <LoadingSpinner size="lg" />
      <p className="text-text-tertiary text-sm">
        {loading ? 'Signing you in with Google...' : 'Redirecting...'}
      </p>
    </div>
  );
}

interface GoogleOAuthRedirectPageProps {
  initialPreExchanged?: PreExchangedGoogleOAuthResult | null;
}

export default function GoogleOAuthRedirectPage({
  initialPreExchanged,
}: GoogleOAuthRedirectPageProps = {}) {
  const { loading } = useGoogleOAuthCallback(initialPreExchanged);

  return <GoogleOAuthRedirectShell loading={loading} />;
}
