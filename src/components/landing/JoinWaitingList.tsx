import type { FC } from 'react';

import { Button } from '../ui/button';

export const JoinWaitingList: FC = () => (
  <Button className="bg-sky-700 hover:bg-sky-800 h-auto px-6 py-3">
    <p className="text-xl">
      加入排隊名單，
      <br className="md:hidden" />
      搶先成為 X-Talent
    </p>
  </Button>
);
