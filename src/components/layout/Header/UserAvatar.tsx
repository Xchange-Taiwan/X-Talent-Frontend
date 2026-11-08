import Image from 'next/image';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { cn } from '@/lib/utils';

export type UserAvatarProps = {
  src?: string | null;
  name?: string;
  size: number;
  className?: string;
  priority?: boolean;
};

export function UserAvatar({
  src,
  name,
  size,
  className,
  priority,
}: UserAvatarProps): JSX.Element {
  return (
    <Image
      src={src || DefaultAvatarImgUrl}
      alt={name ? `${name} 的頭像` : '我的頭像'}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn('rounded-full object-cover', className)}
      priority={priority}
    />
  );
}
