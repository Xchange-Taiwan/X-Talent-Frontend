export type ClarityQueueEntry = IArguments | unknown[];

export interface ClarityFunction {
  (...args: unknown[]): void;
  q?: ClarityQueueEntry[];
}

declare global {
  interface Window {
    clarity?: ClarityFunction;
  }
}
