import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import Image from 'next/image';
import { FC, useState } from 'react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import { SCREEN_SIZE } from '@/constant/theme';
import useWindowSize from '@/hooks/useWindowSize';

import {
  getDefaultSliderAvatar,
  getSlideAvatar,
  SlideItem,
  sliderList,
} from './data';

export interface HomePageSliderProps {
  items?: SlideItem[];
}

export const HomePageSlider: FC<HomePageSliderProps> = ({
  items = sliderList,
}) => {
  const { width } = useWindowSize();
  const [failedIndices, setFailedIndices] = useState<Record<number, boolean>>(
    {}
  );

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      spaceBetween={0}
      slidesPerView={width > SCREEN_SIZE.lg ? 2 : 1}
      loop
      pagination={{ clickable: true }}
      autoplay={{
        delay: 5000,
        disableOnInteraction: false,
      }}
    >
      {items.map(({ name, text, avatar }, index) => {
        const resolvedAvatar = failedIndices[index]
          ? getDefaultSliderAvatar(index)
          : getSlideAvatar({ name, avatar }, index);

        return (
          <SwiperSlide
            className="m-0 w-full"
            key={`${name}_Slide_${index + 1}`}
          >
            <div className="mb-4 flex flex-col gap-10 px-6 py-8 sm:flex-row">
              <div className="flex flex-shrink-0 basis-40 flex-col items-center gap-4">
                <div className="relative size-28 overflow-clip rounded-full">
                  <Image
                    fill
                    src={resolvedAvatar}
                    alt={`avatar_${name}`}
                    sizes="112px"
                    className="object-cover"
                    onError={() =>
                      setFailedIndices((prev) =>
                        prev[index] ? prev : { ...prev, [index]: true }
                      )
                    }
                  />
                </div>
                <p className="text-logoBlue text-center text-xl font-bold">
                  {name}
                </p>
              </div>
              <p className="min-w-0 flex-1">{text}</p>
            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
};
