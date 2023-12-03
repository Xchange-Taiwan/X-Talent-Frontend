import * as React from 'react';

function Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M10 5.833V2.5H1.667v15h16.666V5.833H10zm-1.667 10h-5v-1.666h5v1.666zm0-3.333h-5v-1.667h5V12.5zm0-3.333h-5V7.5h5v1.667zm0-3.334h-5V4.167h5v1.666zm8.334 10H10V7.5h6.667v8.333zM15 9.167h-3.333v1.666H15V9.167zm0 3.333h-3.333v1.667H15V12.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export default Icon;
