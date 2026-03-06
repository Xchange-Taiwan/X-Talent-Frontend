import Image from 'next/image';

import { Button } from '@/components/ui/button';

interface EmailVerifiedPresentationProps {
  icon: string;
  title: string;
  content: string;
  btnContent: string;
  onSetProfile: () => void;
}

export default function EmailVerifiedPresentation({
  icon,
  title,
  content,
  btnContent,
  onSetProfile,
}: EmailVerifiedPresentationProps) {
  return (
    <div className="mx-auto my-40 max-w-[90%] overflow-hidden rounded-2xl border-2 border-solid border-background-border md:max-w-[630px]">
      <div className="relative h-[108px] bg-[#EBFBFB]">
        <Image
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3 transform"
          src={icon}
          alt="Verify Email"
          width={80}
          height={80}
        />
      </div>
      <div className="flex flex-col items-center gap-6 p-20 text-center">
        <h1 className="text-[32px] font-bold leading-10">{title}</h1>

        <p className="text-neutral-600">{content}</p>

        <Button className="max-w-60 rounded-full" onClick={onSetProfile}>
          {btnContent}
        </Button>
      </div>
    </div>
  );
}
