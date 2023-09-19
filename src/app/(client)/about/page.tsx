'use client';

import Image from 'next/image';
import React from 'react';

import aboutPage_1 from '../../../../public/aboutPage_1.png';
import aboutPage_icon_1 from '../../../../public/aboutPage_icon_1.svg';
import aboutPage_icon_2 from '../../../../public/aboutPage_icon_2.svg';
import aboutPage_icon_3 from '../../../../public/aboutPage_icon_3.svg';
import landingPage_icon_7 from '../../../../public/landingPage_icon_7.svg';
import landingPage_icon_8 from '../../../../public/landingPage_icon_8.svg';
import landingPage_icon_9 from '../../../../public/landingPage_icon_9.png';
import landingPage_icon_10 from '../../../../public/landingPage_icon_10.svg';
import { FeatureItem } from '.././components/home';

const About = () => {
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
  return (
    <>
      <div className="relative m-auto flex h-[800px] w-full items-center justify-center xl:max-w-screen-2xl">
        <div className="flex flex-col items-center md:w-[440px] xl:w-[600px]">
          <p className="mb-5 text-center text-5xl font-bold tracking-[0.17em] text-midnight-blue">
            關於 <br className="md:hidden" />
            X-Talent
          </p>
        </div>
        <div className="absolute right-[-100px] top-[-150px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-coral-pink xl:right-[10px]"></div>
        <div className="absolute right-[-40px] top-[380px] z-10 h-[261px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-purple md:right-[-80px] md:top-[450px] xl:right-[80px] xl:top-[370px]"></div>
        <div className="absolute right-[-500px] top-[530px] z-10 h-[181px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-orange xl:right-[-80px]"></div>
        <div className="absolute right-[-500px] top-[-30px] z-10 h-[460px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-blue xl:right-[-210px]"></div>
        <div className="absolute right-[-500px] top-[300px] z-10 h-[257px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-turquoise xl:right-[-260px]"></div>
        <div className="absolute  left-[-300px] top-[130px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-blue md:top-[-105px] md:bg-orange xl:left-[70px]"></div>
        <div className="absolute left-[-50px] top-[260px] z-10 h-[181px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-yellow md:left-[30px] xl:left-[160px]"></div>
        <div className="absolute left-[-500px] top-[400px] z-10 h-[439px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-blue xl:left-[-120px]"></div>
        <div className="absolute left-[-500px] top-[-100px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-coral-pink xl:left-[-250px]"></div>
        <div className="absolute left-[-500px] top-[250px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-purple xl:left-[-280px]"></div>
      </div>
      <div className="relative flex h-[550px] flex-col items-center justify-center md:m-auto xl:w-[1280px]">
        <p className="mb-5 text-2xl font-bold text-midnight-blue">
          和 X-Talent 一起拓展職涯的選擇性
        </p>
        <Image src={aboutPage_1} className="my-8 w-[500px]" alt="1" />
        <p className="mb-[100px] mt-5 p-10 text-xl text-black">
          X-Talent 源自於台灣最大的互聯網工作者社群 XChange
          ，有許多想要轉換跑道與資深的工作者，持續在平台中與各領域人才諮詢與交流，不僅僅精進專業技能，也在人脈拓展的同時，釐清職涯道路，甚至獲得內部推薦，產生改變與持續成長。
        </p>
      </div>
      <div className="flex h-[557px] w-full bg-dark-blue">
        <div className="relative m-auto flex h-full w-[767px] flex-col items-center justify-center xl:w-[1280px]">
          <p className="mb-5 text-2xl font-bold text-white">
            X-Talent 的核心價值
          </p>
          <div className="my-[80px] flex flex-row items-center">
            <div className="flex flex-col items-center">
              <Image className="m-0" src={aboutPage_icon_1} alt="1" />
              <p className="mt-7 font-medium text-white">交流</p>
            </div>
            <div className="flex w-[50vw] max-w-[400px] flex-col items-center">
              <Image className="m-0" src={aboutPage_icon_2} alt="1" />
              <p className="mt-7 font-medium text-white">改變</p>
            </div>
            <div className="flex flex-col items-center">
              <Image className="m-0" src={aboutPage_icon_3} alt="1" />
              <p className="mt-7 font-medium text-white">成長</p>
            </div>
          </div>
          <p className="px-10 font-medium text-white">
            一個涵蓋不同領域的人才平台，讓我們能不只是在摸索與碰撞中成長，而是可以從跨領域的
            Mentor 中加速專業與軟實力的成長。
          </p>
          <p className="px-10 font-medium text-white">
            站在資深PM的肩膀上，運用最少的時間，獲取最多的經驗，一同在PM職涯上有所突破。
          </p>
        </div>
      </div>
      <div className="flex h-[850px] w-full md:h-[661px]">
        <div className="flex w-full flex-col items-center justify-center">
          <p className="mb-[30px] text-center text-2xl font-bold tracking-[0.04em] text-midnight-blue md:mb-[70px]">
            透過 X -Talent 創造你
            <br className="md:hidden" />
            的職涯可能性
          </p>
          <div className="flex flex-col flex-wrap justify-center font-bold text-black md:flex-row">
            {featureData.map((item, index) => (
              <FeatureItem key={index} icon={item.icon} text={item.text} />
            ))}
          </div>
          <button className="mt-[20px] h-[80px] w-[262px] rounded-md bg-teal-blue text-xl font-bold tracking-[0.09em] text-white md:h-[51px] md:w-[415px] xl:mt-[121px]">
            加入排隊名單，
            <br className="md:hidden" />
            搶先成為 X-Talent →
          </button>
        </div>
      </div>
    </>
  );
};

export default About;
