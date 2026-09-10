import Image from 'next/image';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { cn } from '@/lib/utils';

export type UserAvatarProps = {
  src?: string | null;
  name?: string;
  size: number;
  className?: string;
  priority?: boolean;
  /**
   * Whether this avatar sits inside a clickable trigger (e.g. the header
   * account-menu button). Adds the same hover-fade and keyboard focus ring
   * feedback used by the reservation page's clickable avatars - relies on
   * the ancestor trigger element having the `group` class.
   */
  interactive?: boolean;
};

export function UserAvatar({
  src,
  name,
  size,
  className,
  priority,
  interactive = false,
}: UserAvatarProps): JSX.Element {
  return (
    <Image
      src={src || DefaultAvatarImgUrl}
      alt={name ? `${name} 的頭像` : '我的頭像'}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn(
        'rounded-full object-cover',
        interactive &&
          'transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-brand-500 group-focus-visible:ring-offset-2',
        className
      )}
      priority={priority}
    />
  );
}
