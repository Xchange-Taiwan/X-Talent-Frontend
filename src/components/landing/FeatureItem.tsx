import Image from 'next/image';

interface FeatureItemProps {
  icon: string;
  width: number;
  height: number;
  text: string;
  className?: string;
  imageClassName?: string;
}

const DEFAULT_CLASS_NAME =
  'mb-6 flex items-center md:mb-[50px] md:w-2/4 md:flex-col xl:mx-[60px] xl:w-auto';
const DEFAULT_IMAGE_CLASS_NAME = 'size-12 md:h-[70px] md:w-[70px]';

export const FeatureItem = ({
  icon,
  width,
  height,
  text,
  className = DEFAULT_CLASS_NAME,
  imageClassName = DEFAULT_IMAGE_CLASS_NAME,
}: FeatureItemProps) => {
  return (
    <div className={className}>
      <Image
        className={imageClassName}
        src={icon}
        width={width}
        height={height}
        alt=""
        role="presentation"
      />
      <p className="ml-[20px] text-base tracking-[0.085em] md:mt-8 md:text-xl">
        {text}
      </p>
    </div>
  );
};
