import Image from 'next/image';


export const FeatureItem = ({ icon, text }: { icon: string, text: string }) => {
  return (
    <div className="flex mb-[50px] md:flex-col items-center md:w-2/4 xl:w-auto xl:mx-[60px]">
      <Image className="w-[70px] h-[70px]" src={icon} alt="1" />
      <p className="ml-[20px] md:mt-8 text-xl tracking-[0.085em]">{text}</p>
    </div>
  );
};
