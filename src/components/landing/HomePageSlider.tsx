import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import Image from 'next/image';
import { FC } from 'react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import { SCREEN_SIZE } from '@/constant/theme';
import useWindowSize from '@/hooks/useWindowSize';

import { sliderList } from './data';

export const HomePageSlider: FC = () => {
  const { width } = useWindowSize();

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
      {sliderList.map(({ name, text, avatar }, index) => (
        <SwiperSlide
          className="margin-0"
          key={`${name}_Slide_${index + 1}`}
          style={{ width: '100%', margin: 0 }}
        >
          <div className="mb-4 flex flex-col gap-10 px-6 py-8 sm:flex-row">
            <div className="flex flex-shrink-0 basis-40 flex-col  items-center gap-4">
              <div className="relative h-28 w-28 overflow-clip rounded-full">
                <Image
                  fill
                  src={avatar}
                  alt={`avatar_${name}`}
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <p className="text-center text-xl font-bold text-[#003C5A]">
                {name}
              </p>
            </div>
            <p className="min-w-0 flex-1">{text}</p>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};
