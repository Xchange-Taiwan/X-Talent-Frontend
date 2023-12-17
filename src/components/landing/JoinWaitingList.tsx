'use client';

import type { FC, ReactNode } from 'react';

import { Button } from '../ui/button';

export const JoinWaitingList: FC<{ children: ReactNode }> = ({ children }) => {
  const handleJoinWaitingList = () => {
    console.log('Join Waiting List');
  };

  return (
    <Button
      className="h-auto bg-[#00678C] px-6 py-3 hover:bg-[#154b5f]"
      onClick={handleJoinWaitingList}
    >
      {children}
    </Button>
  );
};
