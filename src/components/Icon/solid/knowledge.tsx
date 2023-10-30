import * as React from 'react';
import { SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> { }

const Knowledge = (props: Props) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 14 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M2 17.5C0.9 17.5 0 18.4 0 19.5H14C14 18.4 13.1 17.5 12 17.5H8V15.5H11C12.1 15.5 13 14.6 13 13.5H5C3.34 13.5 2 12.16 2 10.5C2 9.41 2.59 8.46 3.47 7.93C3.88 8.52 4.53 8.93 5.3 8.99C6 9.05 6.66 8.8 7.15 8.37L7.74 9.98L8.68 9.64L9.02 10.58L10.9 9.9L10.56 8.96L11.5 8.62L8.76 1.1L7.82 1.44L7.48 0.5L5.6 1.18L5.94 2.12L5 2.47L5.56 4.02C4.39 3.98 3.37 4.77 3.08 5.88C1.27 6.64 0 8.42 0 10.5C0 13.26 2.24 15.5 5 15.5V17.5H2ZM7.86 3.02L9.57 7.72L8.63 8.06L6.92 3.36L7.86 3.02ZM5.5 5.5C6.05 5.5 6.5 5.95 6.5 6.5C6.5 7.05 6.05 7.5 5.5 7.5C4.95 7.5 4.5 7.05 4.5 6.5C4.5 5.95 4.95 5.5 5.5 5.5Z" fill="#282828" />
  </svg>
);

export default Knowledge;
