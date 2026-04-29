import Image from 'next/image';
import { StaticImageData } from 'next/image';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';

interface AvatarWithBadgeProps {
  avatar: string | StaticImageData;
  years: string;
  name: string;
}

export const AvatarWithBadge = ({
  avatar,
  years,
  name,
}: AvatarWithBadgeProps) => {
  const displayYears =
    TotalWorkSpanEnum[years as keyof typeof TotalWorkSpanEnum] ?? years;

  return (
    <figure className="relative h-[348px] w-full overflow-hidden xl:h-[292px]">
      <Image
        src={avatar}
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
