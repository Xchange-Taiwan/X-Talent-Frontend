'use client';

import type { FC, ReactNode } from 'react';

import { Button } from '../ui/button';

export const JoinWaitingList: FC<{ children: ReactNode }> = ({ children }) => {
  const handleJoinWaitingList = () => {
    console.log('Join Waiting List');
  };

  return (
    <Button
      className="h-auto bg-sky-700 px-6 py-3 hover:bg-sky-800"
      onClick={handleJoinWaitingList}
    >
      {children}
    </Button>
  );
};
