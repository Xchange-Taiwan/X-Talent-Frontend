import { Suspense } from 'react';

import { GoogleOAuthRedirectShell } from './container';
import {
  type GoogleOAuthCallbackPageProps,
  ServerGoogleOAuthBootstrap,
} from './ServerGoogleOAuthBootstrap';

export default function Page({ searchParams }: GoogleOAuthCallbackPageProps) {
  return (
    <Suspense fallback={<GoogleOAuthRedirectShell loading />}>
      <ServerGoogleOAuthBootstrap searchParams={searchParams} />
    </Suspense>
  );
}
