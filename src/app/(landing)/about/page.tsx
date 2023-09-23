import Image from 'next/image';
import { FC, Fragment, ReactNode } from 'react';

import aboutPage_1 from '@/assets/landing/aboutPage_1.png';
import aboutPage_icon_1 from '@/assets/landing/aboutPage_icon_1.svg';
import aboutPage_icon_2 from '@/assets/landing/aboutPage_icon_2.svg';
import aboutPage_icon_3 from '@/assets/landing/aboutPage_icon_3.svg';
import landingPage_icon_7 from '@/assets/landing/landingPage_icon_7.svg';
import landingPage_icon_8 from '@/assets/landing/landingPage_icon_8.svg';
import landingPage_icon_9 from '@/assets/landing/landingPage_icon_9.png';
import landingPage_icon_10 from '@/assets/landing/landingPage_icon_10.svg';
import { JoinWaitingList } from '@/components/landing/JoinWaitingList';

const SectionTitle: FC<{ children: ReactNode }> = ({ children }) => (
  <h2 className="mb-20 text-center text-2xl font-bold">{children}</h2>
);

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  return (
    <div className="mb-[50px] flex items-center md:w-2/4 md:flex-col xl:mx-[60px] xl:w-auto">
      <Image className="h-[70px] w-[70px]" src={icon} alt="1" />
      <p className="ml-[20px] text-xl tracking-[0.085em] md:mt-8">{text}</p>
    </div>
  );
};

const featureData = [
  {
    icon: landingPage_icon_7,
    text: '產業洞見線上分享',
  },
  {
    icon: landingPage_icon_8,
    text: '職涯心法座談會',
  },
  {
    icon: landingPage_icon_9,
    text: '填寫問卷尋找導師',
  },
  {
    icon: landingPage_icon_10,
    text: '一對一深度交流',
  },
];

export default function Page() {
  return (
    <Fragment>
      <section className="relative  flex h-[532px] w-full items-center justify-center overflow-hidden bg-[url('/landing/hero-background-sm.svg')] bg-cover bg-center sm:bg-[url('/landing/hero-background.svg')]">
        <h1 className="text-center text-5xl font-bold leading-normal tracking-widest text-blue-950">
          關於 <br className="md:hidden" />
          X-Talent
        </h1>
      </section>

      <section className="py-14">
        <SectionTitle>X-Talent 的起心動念</SectionTitle>
        <div className="flex flex-col items-center gap-14">
          <Image
            width={500}
            height={320}
            src={aboutPage_1}
            alt="X-Talent fleeting idea"
            priority={false}
            placeholder="blur"
          />
          <p className="max-w-5xl px-8 text-center text-xl lg:px-0">
            X-Talent 源自於台灣最大的互聯網工作者社群 XChange
            ，有許多想要轉換跑道與資深的工作者，持續在平台中與各領域人才諮詢與交流，不僅僅精進專業技能，也在人脈拓展的同時，釐清職涯道路，甚至獲得內部推薦，產生改變與持續成長。
          </p>
        </div>
      </section>

      <section className="bg-blue-950 py-20 text-center text-white">
        <SectionTitle>X-Talent 的核心價值</SectionTitle>

        <div className="mx-auto mb-20 flex max-w-xl justify-between px-12 sm:px-0">
          <div>
            <Image src={aboutPage_icon_1} alt="share" />
            <p className="mt-7 font-medium">交流</p>
          </div>
          <div>
            <Image src={aboutPage_icon_2} alt="change" />
            <p className="mt-7 font-medium">改變</p>
          </div>
          <div>
            <Image src={aboutPage_icon_3} alt="growth" />
            <p className="mt-7 font-medium ">成長</p>
          </div>
        </div>

        <p className="px-8 text-center text-xl lg:px-0">
          一個涵蓋不同領域的人才平台，讓我們能不只是在摸索與碰撞中成長，而是可以從跨領域的
          Mentor 中加速專業與軟實力的成長。
          <br />
          站在資深PM的肩膀上，運用最少的時間，獲取最多的經驗，一同在PM職涯上有所突破。
        </p>
      </section>

      <section className="py-20">
        <SectionTitle>
          透過 X -Talent 創造你
          <br className="md:hidden" />
          的職涯可能性
        </SectionTitle>
        <div className="flex w-full flex-col items-center justify-center">
          <div className="flex flex-col flex-wrap justify-center font-bold text-black md:flex-row">
            {featureData.map((item, index) => (
              <FeatureItem key={index} icon={item.icon} text={item.text} />
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24 pt-10 text-center">
        <JoinWaitingList />
      </section>
    </Fragment>
  );
}
