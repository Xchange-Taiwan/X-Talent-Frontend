import Image, { StaticImageData } from 'next/image';
import { ReactNode } from 'react';

interface AuthMessageCardProps {
  icon: string | StaticImageData;
  iconAlt?: string;
  title: string;
  children: ReactNode;
  contentClassName?: string;
}

export default function AuthMessageCard({
  icon,
  iconAlt = 'Auth Message',
  title,
  children,
  contentClassName = 'px-6 py-10 text-center md:p-20',
}: AuthMessageCardProps) {
  return (
    <div className="mx-auto my-8 max-w-[90%] overflow-hidden rounded-2xl border-2 border-solid border-background-border md:my-40 md:max-w-[630px]">
      <div className="relative h-[108px] bg-brand-50">
        <Image
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3 transform"
          src={icon}
          alt={iconAlt}
          width={80}
          height={80}
        />
      </div>
      <div className={`flex flex-col items-center gap-6 ${contentClassName}`}>
        <h1 className="text-32 leading-10 font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
