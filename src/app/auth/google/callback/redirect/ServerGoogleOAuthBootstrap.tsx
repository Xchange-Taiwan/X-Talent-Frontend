import { exchangeGoogleOAuthCodeServer } from '@/lib/auth/bffSession.server';

import GoogleOAuthRedirectPage from './container';

export interface GoogleOAuthCallbackPageProps {
  searchParams?: Promise<{
    code?: string | string[];
    state?: string | string[];
  }>;
}

function readSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export async function ServerGoogleOAuthBootstrap({
  searchParams,
}: GoogleOAuthCallbackPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const code = readSingleParam(resolvedParams?.code);
  const state = readSingleParam(resolvedParams?.state);

  const initialPreExchanged =
    code && state ? await exchangeGoogleOAuthCodeServer(code, state) : null;

  return <GoogleOAuthRedirectPage initialPreExchanged={initialPreExchanged} />;
}
