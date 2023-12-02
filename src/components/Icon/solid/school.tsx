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
        d="M10 2.5l-9.167 5 3.334 1.817v5L10 17.5l5.833-3.183v-5l1.667-.909v5.759h1.667V7.5L10 2.5zm5.683 5L10 10.6 4.317 7.5 10 4.4l5.683 3.1zm-1.516 5.825L10 15.6l-4.167-2.275v-3.1L10 12.5l4.167-2.275v3.1z"
        fill="currentColor"
      />
    </svg>
  );
}

export default Icon;
