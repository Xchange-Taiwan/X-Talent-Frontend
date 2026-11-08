import { Suspense } from 'react';

import EmailVerifiedContainer from './container';

export default function Page() {
  return (
    <Suspense>
      <EmailVerifiedContainer />
    </Suspense>
  );
}
