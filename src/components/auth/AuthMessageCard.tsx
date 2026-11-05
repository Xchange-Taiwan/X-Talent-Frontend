import Image, { StaticImageData } from 'next/image';
import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import AuthCard from './AuthCard';

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
  contentClassName,
}: AuthMessageCardProps) {
  return (
    <AuthCard
      showBanner
      bannerContent={
        <Image
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3 transform"
          src={icon}
          alt={iconAlt}
          width={80}
          height={80}
        />
      }
      contentClassName={cn('text-center', contentClassName)}
    >
      <h1 className="text-32 text-text-primary leading-10 font-bold">
        {title}
      </h1>
      {children}
    </AuthCard>
  );
}
