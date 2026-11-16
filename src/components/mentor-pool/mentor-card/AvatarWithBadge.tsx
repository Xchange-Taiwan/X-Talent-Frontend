import Image, { type StaticImageData } from 'next/image';

import avatarImage from '@/assets/default-avatar.png';
import { TotalWorkSpanEnum } from '@/constant/seniority';

interface AvatarWithBadgeProps {
  avatar: string | StaticImageData;
  years: string;
  name: string;
  priority?: boolean;
}

export const AvatarWithBadge = ({
  avatar,
  years,
  name,
  priority = false,
}: AvatarWithBadgeProps) => {
  const displayYears =
    TotalWorkSpanEnum[years as keyof typeof TotalWorkSpanEnum] ?? years;
  const resolvedAvatar =
    typeof avatar === 'string' ? avatar.trim() || avatarImage : avatar;

  return (
    <figure className="relative h-[348px] w-full shrink-0 overflow-hidden xl:h-[292px]">
      <Image
        src={resolvedAvatar}
        alt={`${name} 的頭像`}
        fill
        sizes="(max-width: 768px) 334px, 413px"
        className="h-full object-cover"
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
      />
      <figcaption className="bg-dark/30 text-text-white absolute right-[30px] bottom-[30px] rounded-lg px-2.5 py-1">
        {displayYears}工作經驗
      </figcaption>
    </figure>
  );
};
