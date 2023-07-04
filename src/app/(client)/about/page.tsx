'use client';

import Image from 'next/image'
import React from "react";

import aboutPage_1 from '../../../../public/aboutPage_1.png';
import aboutPage_icon_1 from '../../../../public/aboutPage_icon_1.svg';
import aboutPage_icon_2 from '../../../../public/aboutPage_icon_2.svg';
import aboutPage_icon_3 from '../../../../public/aboutPage_icon_3.svg';
import landingPage_icon_7 from '../../../../public/landingPage_icon_7.svg';
import landingPage_icon_8 from '../../../../public/landingPage_icon_8.svg';
import landingPage_icon_9 from '../../../../public/landingPage_icon_9.png';
import landingPage_icon_10 from '../../../../public/landingPage_icon_10.svg';
import { FeatureItem } from ".././components/home";



const About = () => {

  const featureData = [
    {
      icon: landingPage_icon_7,
      text: '產業洞見線上分享'
    },
    {
      icon: landingPage_icon_8,
      text: '職涯心法座談會'
    },
    {
      icon: landingPage_icon_9,
      text: '填寫問卷尋找導師'
    },
    {
      icon: landingPage_icon_10,
      text: '一對一深度交流'
    }
  ];
  return (
    <>
      <div className="m-auto h-[800px] relative w-full flex items-center justify-center xl:max-w-screen-2xl">
        <div className="flex flex-col items-center md:w-[440px] xl:w-[600px]">
          <p className="text-midnight-blue text-center text-5xl mb-5 font-bold tracking-[0.17em]">關於 <br className="md:hidden" />X-Talent</p>
        </div>
        <div className="bg-coral-pink w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[-150px] right-[-100px] xl:right-[10px] overflow-hidden z-10"></div>
        <div className="bg-purple w-24 h-[261px] rotate-45 rounded-[124px] absolute top-[380px] md:top-[450px] right-[-40px] md:right-[-80px] xl:top-[370px] xl:right-[80px] overflow-hidden z-10"></div>
        <div className="bg-orange w-24 h-[181px] rotate-45 rounded-[124px] absolute top-[530px] right-[-500px] xl:right-[-80px] overflow-hidden z-10"></div>
        <div className="bg-blue w-24 h-[460px] rotate-45 rounded-[124px] absolute top-[-30px] right-[-500px] xl:right-[-210px] overflow-hidden z-10"></div>
        <div className="bg-turquoise w-24 h-[257px] rotate-45 rounded-[124px] absolute top-[300px] right-[-500px] xl:right-[-260px] overflow-hidden z-10"></div>
        <div className="bg-blue  md:bg-orange w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[130px] md:top-[-105px] left-[-300px] xl:left-[70px] overflow-hidden z-10"></div>
        <div className="bg-yellow w-24 h-[181px] rotate-45 rounded-[124px] absolute top-[260px] left-[-50px] md:left-[30px] xl:left-[160px] overflow-hidden z-10"></div>
        <div className="bg-blue w-24 h-[439px] rotate-45 rounded-[124px] absolute top-[400px] left-[-500px] xl:left-[-120px] overflow-hidden z-10"></div>
        <div className="bg-coral-pink w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[-100px] left-[-500px] xl:left-[-250px] overflow-hidden z-10"></div>
        <div className="bg-purple w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[250px] left-[-500px] xl:left-[-280px] overflow-hidden z-10"></div>
      </div>
      <div className="flex flex-col justify-center items-center md:m-auto h-[790px] xl:w-[1280px] relative">
        <p className="text-midnight-blue text-2xl mb-5 font-bold">和 X-Talent 一起拓展職涯的選擇性</p>
        <Image src={aboutPage_1} className="w-[500px] my-8" alt="1" />
        <p className="text-black text-xl mt-5 p-10">X-Talent 源自於台灣最大的互聯網工作者社群 XChange ，有許多想要轉換跑道與資深的工作者，持續在平台中與各領域人才諮詢與交流，不僅僅精進專業技能，也在人脈拓展的同時，釐清職涯道路，甚至獲得內部推薦，產生改變與持續成長。</p>
      </div>
      <div className="bg-dark-blue flex h-[557px] w-full">
        <div className="relative m-auto h-full w-[767px] flex flex-col justify-center items-center xl:w-[1280px]">
          <p className="text-white text-2xl mb-5 font-bold">X-Talent 的核心價值</p>
          <div className="flex flex-row my-[80px] items-center">
            <div className="flex flex-col items-center">
              <Image className="m-0" src={aboutPage_icon_1} alt="1" />
              <p className="text-white font-medium mt-7">交流</p>
            </div>
            <div className="flex w-[50vw] max-w-[400px] flex-col items-center">
              <Image className="m-0" src={aboutPage_icon_2} alt="1" />
              <p className="text-white font-medium mt-7">改變</p>
            </div>
            <div className="flex flex-col items-center">
              <Image className="m-0" src={aboutPage_icon_3} alt="1" />
              <p className="text-white font-medium mt-7">成長</p>
            </div>
          </div>
          <p className="text-white px-10 font-medium">一個涵蓋不同領域的人才平台，讓我們能不只是在摸索與碰撞中成長，而是可以從跨領域的 Mentor 中加速專業與軟實力的成長。</p>
          <p className="text-white px-10 font-medium">站在資深PM的肩膀上，運用最少的時間，獲取最多的經驗，一同在PM職涯上有所突破。</p>
        </div>
      </div>
      <div className="h-[850px] md:h-[661px] flex w-full">
        <div className="flex flex-col w-full justify-center items-center">
          <p className="text-midnight-blue text-2xl font-bold mb-[30px] md:mb-[70px] tracking-[0.04em] text-center">透過 X -Talent 創造你<br className="md:hidden" />的職涯可能性</p>
          <div className="flex flex-col md:flex-row text-black flex-wrap font-bold justify-center">
            {featureData.map((item, index) => (
              <FeatureItem key={index} icon={item.icon} text={item.text} />
            ))}
          </div>
          <button className="bg-teal-blue w-[262px] h-[80px] mt-[20px] xl:mt-[121px] md:w-[415px] md:h-[51px] rounded-md text-white text-xl font-bold tracking-[0.09em]">加入排隊名單，<br className="md:hidden" />搶先成為 X-Talent →</button>
        </div>
      </div>
    </>
  )
}

export default About;
