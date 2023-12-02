'use client';
import Image from 'next/image';
import { FC, Fragment } from 'react';

import OnboardingCoverImgUrl from '@/assets/auth/onboarding-cover.png';
import { Progress } from '@/components/ui/progress';
import { useMultiStepForm } from '@/hooks/useMultiStepForm';

const Step1: FC = () => <div>Step1</div>;
const Step2: FC = () => <div>Step2</div>;
const Step3: FC = () => <div>Step3</div>;
const Step4: FC = () => <div>Step4</div>;

export default function Page() {
  const { currentStep, stepElement, progress, goToNext, goToBack } =
    useMultiStepForm([
      <Step1 key="Step1" />,
      <Step2 key="Step2" />,
      <Step3 key="Step3" />,
      <Step4 key="Step4" />,
    ]);

  return (
    <Fragment>
      <Progress className="h-2 rounded-none bg-white" value={progress * 100} />
      <div className="flex">
        <div className="relative min-h-[calc(100vh-70px-8px)] flex-1">
          <Image
            src={OnboardingCoverImgUrl}
            fill={true}
            alt="onboarding-cover"
            className="object-cover object-center"
          />
          P
        </div>
        <div className="mx-1 flex-1 p-20">
          <p>{currentStep}</p>
          <button onClick={goToNext}>Next</button>
          <button onClick={goToBack}>Back</button>
          {stepElement}
        </div>
      </div>
    </Fragment>
  );
}
