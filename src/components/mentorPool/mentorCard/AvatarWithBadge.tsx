import Image from 'next/image';
import { StaticImageData } from 'next/image';

interface AvatarWithBadgeProps {
  avatar: StaticImageData;
  years: string;
}

export const AvatarWithBadge = ({ avatar, years }: AvatarWithBadgeProps) => {
  return (
    <figure className="relative h-[292px] w-full overflow-hidden">
      <Image
        src={avatar}
        alt="avatar"
        fill
        sizes="100vw"
        className="h-full object-cover"
      />
      <figcaption className="absolute bottom-[30px] right-[30px] rounded-lg bg-[#000000]/30 px-2.5 py-1 text-text-white">
        {years} years Experience
      </figcaption>
    </figure>
  );
};
