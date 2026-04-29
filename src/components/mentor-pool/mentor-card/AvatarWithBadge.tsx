import Image from 'next/image';
import { StaticImageData } from 'next/image';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';

interface AvatarWithBadgeProps {
  avatar: string | StaticImageData;
  // Bumped when the user uploads a new avatar; used as a `?v=` cache buster on
  // the stable S3 URL. Skipped when null/undefined to keep `?v=null` out of the
  // Image Optimizer cache key.
  avatarVersion?: number | null;
  years: string;
  name: string;
}

export const AvatarWithBadge = ({
  avatar,
  avatarVersion,
  years,
  name,
}: AvatarWithBadgeProps) => {
  const displayYears =
    TotalWorkSpanEnum[years as keyof typeof TotalWorkSpanEnum] ?? years;

  const avatarSrc =
    typeof avatar === 'string' && avatarVersion != null
      ? `${avatar}?v=${avatarVersion}`
      : avatar;

  return (
    <figure className="relative h-[348px] w-full overflow-hidden xl:h-[292px]">
      <Image
        src={avatarSrc}
        alt={`${name} 的頭像`}
        fill
        sizes="(max-width: 768px) 334px, 413px"
        className="h-full object-cover"
      />
      <figcaption className="absolute bottom-[30px] right-[30px] rounded-lg bg-[#000000]/30 px-2.5 py-1 text-text-white">
        {displayYears}工作經驗
      </figcaption>
    </figure>
  );
};
