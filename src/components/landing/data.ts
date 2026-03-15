import { StaticImageData } from 'next/image';

import SliderCarolinaImgUrl from './assets/slider_carolina.png';
import SliderPinHuaImgUrl from './assets/slider_pin_hua.png';

export interface SlideItem {
  name: string;
  text: string;
  avatar: StaticImageData;
}

const TESTIMONIAL_TEXT =
  '剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！';

export const sliderList: SlideItem[] = [
  { name: 'Carolina', text: TESTIMONIAL_TEXT, avatar: SliderCarolinaImgUrl },
  { name: 'Pin-Hua Chen', text: TESTIMONIAL_TEXT, avatar: SliderPinHuaImgUrl },
  { name: 'Carolina', text: TESTIMONIAL_TEXT, avatar: SliderCarolinaImgUrl },
  { name: 'Pin-Hua Chen', text: TESTIMONIAL_TEXT, avatar: SliderPinHuaImgUrl },
  { name: 'Carolina', text: TESTIMONIAL_TEXT, avatar: SliderCarolinaImgUrl },
  { name: 'Pin-Hua Chen', text: TESTIMONIAL_TEXT, avatar: SliderPinHuaImgUrl },
];
