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
      className={`from-blue-active to-pink-active relative h-[111px] bg-gradient-to-br sm:h-[100px] ${className || ''}`}
    >
      {children}
    </div>
  );
};
