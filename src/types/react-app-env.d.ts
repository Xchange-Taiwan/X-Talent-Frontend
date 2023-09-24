/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.png';
declare module '*.jpeg';
declare module '*.jpg';

declare module '*.svg' {
  import * as React from 'react';

  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;

  const src: string;
  export default src;
}
