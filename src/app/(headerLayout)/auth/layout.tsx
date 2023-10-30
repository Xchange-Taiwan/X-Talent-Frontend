'use client';
import * as Progress from '@radix-ui/react-progress';
import { createContext, Dispatch, SetStateAction, useState } from 'react';

import iPadImgUrl from '@/assets/auth/iPad-cover.png';

interface ProgressContextProps {
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
}

export const ProgressContext = createContext<ProgressContextProps | null>(null);

export default function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState(25);
  return (
    <ProgressContext.Provider value={{ progress, setProgress }}>
      <div className="flex h-[calc(100vh_-_70px)]">
        <div
          className="hidden flex-1 bg-cover bg-right bg-no-repeat sm:block"
          style={{ backgroundImage: `url(${iPadImgUrl.src})` }}
        />
        <Progress.Root
          className="absolute overflow-hidden bg-blackA9 w-screen h-[8px]"
          style={{ transform: 'translateZ(0)' }}
          value={progress}
        >
          <Progress.Indicator
            className="bg-primary w-full h-full transition-transform duration-[660ms] ease-[cubic-bezier(0.65, 0, 0.35, 1)]"
            style={{ transform: `translateX(-${100 - progress}%)` }}
          />
        </Progress.Root>
        <div className="flex-1 flex overflow-auto">{children}</div>
      </div>
    </ProgressContext.Provider>
  );
}
