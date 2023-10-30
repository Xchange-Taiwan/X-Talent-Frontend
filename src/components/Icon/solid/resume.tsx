import * as React from 'react';
import { SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> { }

const Resume = (props: Props) => (
  <svg
    width="16"
    height="20"
    viewBox="0 0 16 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M10 0H2C0.9 0 0 0.9 0 2V18C0 19.1 0.9 20 2 20H14C15.1 20 16 19.1 16 18V6L10 0ZM14 18H2V2H10V6H14V18ZM8 15C6.9 15 6 14.1 6 13V7.5C6 7.22 6.22 7 6.5 7C6.78 7 7 7.22 7 7.5V13H9V7.5C9 6.12 7.88 5 6.5 5C5.12 5 4 6.12 4 7.5V13C4 15.21 5.79 17 8 17C10.21 17 12 15.21 12 13V9H10V13C10 14.1 9.1 15 8 15Z" fill="#282828" />
  </svg>
);

export default Resume;
