import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import Image, { StaticImageData } from 'next/image';
import { FC } from 'react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import { SCREEN_SIZE } from '@/constant/theme';
import useWindowSize from '@/hooks/useWindowSize';

import SliderCarolinaImgUrl from './assets/slider_carolina.png';
import SliderPinHuaImgUrl from './assets/slider_pin_hua.png';

interface SlideItem {
  name: string;
  text: string;
  avatar: StaticImageData;
}

const SliderList: SlideItem[] = [
  {
    name: 'Carolina',
    text: '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！',
    avatar: SliderCarolinaImgUrl,
  },
  {
    name: 'Pin-Hua Chen',
    text: '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！',
    avatar: SliderPinHuaImgUrl,
  },
  {
    name: 'Carolina',
    text: '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！',
    avatar: SliderCarolinaImgUrl,
  },
  {
    name: 'Pin-Hua Chen',
    text: '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！',
    avatar: SliderPinHuaImgUrl,
  },
  {
    name: 'Carolina',
    text: '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！',
    avatar: SliderCarolinaImgUrl,
  },
  {
    name: 'Pin-Hua Chen',
    text: '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！',
    avatar: SliderPinHuaImgUrl,
  },
];

export const HomePageSlider: FC = () => {
  const { width } = useWindowSize();

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      spaceBetween={0}
      slidesPerView={width > SCREEN_SIZE.md ? 2 : 1}
      loop
      pagination={{ clickable: true }}
      autoplay={{
        delay: 5000,
        disableOnInteraction: false,
      }}
      onSlideChange={() => console.log('slide change')}
      onSwiper={(swiper) => console.log(swiper)}
    >
      {SliderList.map(({ name, text, avatar }, index) => (
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
                  className="object-cover"
                />
              </div>
              <p className="text-center text-xl font-bold text-[#003C5A]">
                {name}
              </p>
            </div>
            <p className="flex-initial">{text}</p>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};
