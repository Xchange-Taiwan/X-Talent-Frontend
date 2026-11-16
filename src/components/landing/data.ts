export interface SlideItem {
  name: string;
  text: string;
  avatar?: string;
}

export const defaultSliderAvatars = [
  '/landing/slider_default_1.webp',
  '/landing/slider_default_2.webp',
  '/landing/slider_default_3.webp',
  '/landing/slider_default_4.webp',
  '/landing/slider_default_5.webp',
  '/landing/slider_default_6.webp',
] as const;

export const realSliderAvatars: Record<string, string> = {
  Carolina: '/landing/slider_carolina.webp',
  'Pin-Hua Chen': '/landing/slider_pin_hua.webp',
};

export function getDefaultSliderAvatar(index: number): string {
  const fallbackIndex =
    ((index % defaultSliderAvatars.length) + defaultSliderAvatars.length) %
    defaultSliderAvatars.length;
  return defaultSliderAvatars[fallbackIndex];
}

export function getSlideAvatar(
  slide: Pick<SlideItem, 'name' | 'avatar'>,
  index: number
): string {
  const explicitAvatar = slide.avatar?.trim();
  if (explicitAvatar) {
    return explicitAvatar;
  }

  const realAvatar = realSliderAvatars[slide.name];
  if (realAvatar) {
    return realAvatar;
  }

  return getDefaultSliderAvatar(index);
}

export const sliderList: SlideItem[] = [
  {
    name: 'Carolina',
    text: '剛畢業時，我對下一步的方向很迷惘。透過 XChange 與不同領域的前輩進行 Coffee Chat 後，我更了解產業的實際樣貌，也重新整理了自己的求職策略。這些真誠的交流，讓我在職涯起步時少走了許多彎路。',
    avatar: '/landing/slider_carolina.webp',
  },
  {
    name: 'Leona',
    text: '過去投遞履歷時，我常常收不到回覆，也不知道問題出在哪裡。XChange 的前輩從招募者的角度給了我具體建議，幫助我重新梳理經歷與成果。調整之後，我不只獲得更多面試機會，也更有信心說出自己的價值。',
  },
  {
    name: 'Amy',
    text: '想跨領域轉職時，最困難的是不知道該從哪裡開始。透過 XChange，我認識了已經走過相似歷程的前輩，從能力準備、作品集到面試方向，都得到非常實際的分享。原本模糊的想法，也逐漸變成可以執行的行動計畫。',
  },
  {
    name: 'Stacy',
    text: '在 XChange 的交流中，前輩不只分享面試技巧，也陪我釐清自己真正想追求的工作環境。這讓我在面試時不再只是努力回答問題，而是能更有方向地呈現自己，並判斷一份工作是否真的適合我。',
  },
  {
    name: 'Tommy',
    text: '網路上雖然有很多職涯資訊，但真正和業界工作者對話，帶來的理解完全不同。透過 XChange，我聽見第一線的工作經驗，也更清楚不同職位需要的能力。每一次交流，都讓我離理想的職涯更近一步。',
  },
  {
    name: 'Roger',
    text: '對我來說，XChange 最珍貴的不只是提供建議，而是創造了真誠連結的機會。一次 Coffee Chat 可能帶來新的觀點、一位願意支持你的前輩，甚至開啟意想不到的合作。謝謝 XChange，讓職涯探索不再是一個人的旅程。',
  },
];
