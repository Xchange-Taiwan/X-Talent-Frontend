import Image from 'next/image';

export const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  return (
    <div className="mb-[50px] flex items-center md:w-2/4 md:flex-col xl:mx-[60px] xl:w-auto">
      <Image className="h-[70px] w-[70px]" src={icon} alt="1" />
      <p className="ml-[20px] text-xl tracking-[0.085em] md:mt-8">{text}</p>
    </div>
  );
};
