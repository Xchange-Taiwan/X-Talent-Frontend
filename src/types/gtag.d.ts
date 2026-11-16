export type DataLayerEntry = Record<string, unknown> | IArguments | unknown[];

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: DataLayerEntry[];
  }
}
