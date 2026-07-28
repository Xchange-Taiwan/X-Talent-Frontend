import type { FC, ReactNode } from 'react';

interface ProfileBannerProps {
  className?: string;
  children?: ReactNode;
}

export const ProfileBanner: FC<ProfileBannerProps> = ({
  className,
  children,
}) => {
  return (
    <div
      className={`relative h-[111px] bg-gradient-to-br from-blue-active to-pink-active sm:h-[100px] ${className || ''}`}
    >
      {children}
    </div>
  );
};
