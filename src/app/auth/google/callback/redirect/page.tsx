import { Suspense } from 'react';

import GoogleOAuthRedirectPage from './container';

export default function Page() {
  return (
    <Suspense>
      <GoogleOAuthRedirectPage />
    </Suspense>
  );
}
