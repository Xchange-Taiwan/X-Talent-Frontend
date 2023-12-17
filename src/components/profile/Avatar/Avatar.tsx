import Image from 'next/image';
import { FC } from 'react';

import CameraImageUrl from './assets/camera.svg';

interface Props {
  imgUrl?: string;
}

export const Avatar: FC<Props> = ({ imgUrl }) => {
  if (!imgUrl) {
    return (
      <div className="bg-light relative h-full w-full cursor-pointer overflow-clip rounded-full">
        <Image
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          src={CameraImageUrl}
          alt="camera"
          width={48}
          height={48}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gray-400 py-1.5 text-center text-[10px] text-white">
          上傳圖像 I
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full cursor-pointer overflow-clip  rounded-full">
      <Image
        className="border-white object-cover object-center"
        src={imgUrl}
        fill
        alt="avatar"
      />
    </div>
  );
};
