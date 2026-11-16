export type ClarityQueueEntry = IArguments | unknown[];

export interface ClarityMetadataPayload {
  projectId?: string;
  userId?: string;
  sessionId?: string;
  pageNum?: number;
}

export interface ClarityFunction {
  (
    command: 'identify',
    customId: string,
    customSessionId?: string,
    customPageId?: string
  ): void;
  (
    command: 'metadata',
    callback: (
      data: ClarityMetadataPayload,
      upgrade?: unknown,
      consent?: unknown
    ) => void,
    wait?: boolean,
    includeConsent?: boolean
  ): void;
  (command: 'upgrade', reason: string): void;
  (command: 'set', key: string, value: string | string[]): void;
  (command: 'event', eventName: string): void;
  <TCommand extends string>(
    command: Exclude<
      TCommand,
      'identify' | 'metadata' | 'upgrade' | 'set' | 'event'
    >,
    ...args: unknown[]
  ): void;
  q?: ClarityQueueEntry[];
}

declare global {
  interface Window {
    clarity?: ClarityFunction;
  }
}
