import { ReactElement, useEffect, useState } from 'react';

export const useMultiStepForm = (steps: ReactElement[]) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (steps.length === 0) {
      setCurrentStep(0);
    } else {
      setCurrentStep(1);
    }
  }, [steps.length]);

  const goToNext = () => {
    setCurrentStep((prev) => (prev >= steps.length ? prev : prev + 1));
  };

  const goToPrev = () => {
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const goToStep = (step: number) => {
    if (step > 0 && step <= steps.length) {
      setCurrentStep(step);
    } else {
      setCurrentStep(1);
    }
  };

  return {
    currentStep,
    stepsTotal: steps.length,
    stepElement: steps[currentStep > 0 ? currentStep - 1 : 0],
    progress: steps.length > 0 ? currentStep / steps.length : 0,
    goToNext,
    goToPrev,
    goToStep,
    isFirstStep: steps.length > 0 ? currentStep === 1 : true,
    isLastStep: steps.length > 0 ? currentStep === steps.length : true,
  };
};
