'use client';
import "swiper/swiper.min.css";
import "swiper/css/pagination";

import Image from 'next/image'
import React from "react";
import { Autoplay, Pagination } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react"

import landingPage_1 from '../../../public/landingPage_1.png';
import landingPage_2 from '../../../public/landingPage_2.png';
import landingPage_3 from '../../../public/landingPage_3.png';
import landingPage_4 from '../../../public/landingPage_4.png';
import landingPage_5 from '../../../public/landingPage_5.png';
import landingPage_6 from '../../../public/landingPage_6.png';
import landingPage_7 from '../../../public/landingPage_7.png';
import landingPage_icon_1 from '../../../public/landingPage_icon_1.svg';
import landingPage_icon_2 from '../../../public/landingPage_icon_2.svg';
import landingPage_icon_3 from '../../../public/landingPage_icon_3.svg';
import landingPage_icon_4 from '../../../public/landingPage_icon_4.svg';
import landingPage_icon_5 from '../../../public/landingPage_icon_5.svg';
import landingPage_icon_6 from '../../../public/landingPage_icon_6.svg';
import landingPage_icon_7 from '../../../public/landingPage_icon_7.svg';
import landingPage_icon_8 from '../../../public/landingPage_icon_8.svg';
import landingPage_icon_9 from '../../../public/landingPage_icon_9.png';
import landingPage_icon_10 from '../../../public/landingPage_icon_10.svg';
import { FeatureItem } from "./components/home";



const Home = () => {

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
      <div className="m-auto h-[670px] md:h-[735px] relative w-full flex items-center justify-center xl:max-w-screen-2xl">
        <div className="flex flex-col items-center md:w-[440px] xl:w-[600px]">
          <p className="text-[#003C5A] text-center text-5xl mb-5 font-bold tracking-[0.17em]">交流讓<br className="md:hidden" />改變發生</p>
          <p className="text-[#1D1D1D] text-2xl font-bold text-center">Find your Mentor/Mentee to<br className="md:hidden" /> build up connections, break up <br className="md:hidden" />limits.</p>
        </div>
        <div className="bg-[#FF6D9D] w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[-150px] right-[-100px] xl:right-[10px] overflow-hidden z-10"></div>
        <Image src={landingPage_1} className="w-52 rounded-full md:top-[300px] right-[-500px] md:right-[-80px] xl:top-[230px] xl:right-[50px] absolute" alt="1" />
        <div className="bg-[#CE8FFF] w-24 h-[261px] rotate-45 rounded-[124px] absolute top-[380px] md:top-[450px] right-[-40px] md:right-[-80px] xl:top-[370px] xl:right-[80px] overflow-hidden z-10"></div>
        <div className="bg-[#FFA957] w-24 h-[181px] rotate-45 rounded-[124px] absolute top-[530px] right-[-500px] xl:right-[-80px] overflow-hidden z-10"></div>
        <div className="bg-[#5DE5FF] w-24 h-[460px] rotate-45 rounded-[124px] absolute top-[-30px] right-[-500px] xl:right-[-210px] overflow-hidden z-10"></div>
        <div className="bg-[#4BEFBD] w-24 h-[257px] rotate-45 rounded-[124px] absolute top-[300px] right-[-500px] xl:right-[-260px] overflow-hidden z-10"></div>
        <Image src={landingPage_2} className="w-52 rounded-full md:top-[500px] left-[-300px] md:left-[-70px] xl:top-[440px] xl:left-[110px] absolute" alt="1" />
        <div className="bg-[#5DE5FF] md:bg-[#FFA957] w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[130px] md:top-[235px] left-[-140px] xl:left-[-20px] overflow-hidden z-10"></div>
        <Image src={landingPage_3} className="w-36 rounded-full top-[140px] left-[-300px] xl:left-[-70px] absolute" alt="1" />
        <div className="bg-[#FFDE4E] w-24 h-[181px] rotate-45 rounded-[124px] absolute top-[600px] left-[-500px] xl:left-[50px] overflow-hidden z-10"></div>
        <div className="bg-[#5DE5FF] w-24 h-[439px] rotate-45 rounded-[124px] absolute top-[720px] left-[-500px] xl:left-[-200px] overflow-hidden z-10"></div>
        <div className="bg-[#FF6D9D] w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[250px] left-[-500px] xl:left-[-300px] overflow-hidden z-10"></div>
        <div className="bg-[#CE8FFF] w-24 h-[452px] rotate-45 rounded-[124px] absolute top-[580px] left-[-500px] xl:left-[-380px] overflow-hidden z-10"></div>
      </div>
      <div className="h-[661px] flex w-full">
        <div className="flex flex-col w-full justify-center items-center">
          <p className="text-[#003C5A] text-2xl font-bold mb-[30px] md:mb-[70px] tracking-[0.04em] text-center">透過 X -Talent 創造你<br className="md:hidden" />的職涯可能性</p>
          <div className="flex flex-col md:flex-row text-[#1D1D1D] flex-wrap font-bold justify-center">
            {featureData.map((item, index) => (
              <FeatureItem key={index} icon={item.icon} text={item.text} />
            ))}
          </div>
          <button className="bg-[#00678C] w-[262px] h-[80px] mt-[20px] xl:mt-[121px] md:w-[415px] md:h-[51px] rounded-md text-white text-xl font-bold tracking-[0.09em]">加入排隊名單，<br className="md:hidden" />搶先成為 X-Talent →</button>
        </div>
      </div>
      <div className="contents md:block md:m-auto md:w-[930px] md:h-[1100px] xl:h-[790px] relative">
        <div className="flex mt-[70px] mb-[50px] xl:mt-7 xl:mb-[130px] items-center flex-col xl:flex-row">
          <Image src={landingPage_4} className="w-[420px]" alt="1" />
          <div className="flex flex-wrap md:mt-10 w-[420px] p-[30px] md:p-0 flex-row xl:w-full xl:flex-col xl:pl-[62px] m-auto">
            <p className="text-[#003C5A] text-2xl mb-5 font-bold">和 X-Talent 一起拓展職涯的選擇性</p>
            <p className="text-[#1D1D1D] text-xl">聚集多種專業職能的資深前輩，分享產業洞見、職涯心法，協助建構更多元的角度與觀點。不論你是剛開始、還未開始，一起陪你把職涯走得更遠更寬闊。</p>
          </div>
        </div>
        <div className="flex mt-7 mb-[50px] md:mb-[130px] items-center flex-col-reverse xl:flex-row">
          <div className="flex flex-wrap md:mt-10 w-[420px] p-[30px] flex-row xl:w-full xl:flex-col xl:pr-[62px] m-auto">
            <p className="text-[#003C5A] text-2xl mb-5 font-bold">透過 X-Talent 展開深度交流</p>
            <p className="text-[#1D1D1D] text-xl">透過 X-Talent 立即安排與 Mentor 一對一的深度交流，讓你在尋求職涯建議、建立人脈上得到最直接的回饋。</p>
          </div>
          <Image src={landingPage_5} className="w-[420px]" alt="1" />
        </div>
      </div>
      <div className="bg-[#172E59] flex h-[907px] md:h-[425px] xl:h-[557px] w-full">
        <div className="relative m-auto h-full md:w-[767px] flex flex-col justify-center md:items-center md:flex-wrap md:flex-row xl:w-[1280px]">
<<<<<<< Updated upstream
          <div className="text-white leading-[58px] my-[15px] md:col-span-2 md:mt-[40px] xl:absolute xl:mt-0 xl:left-[60px] xl:top-[176px] text-4xl font-bold ">
=======
          <div className="text-white w-auto leading-[58px] my-[15px] md:col-span-2 md:mt-[40px] xl:absolute xl:mt-0 xl:left-[60px] xl:top-[176px] text-4xl font-bold ">
>>>>>>> Stashed changes
            <p>9000+ XChangers</p>
            <p>for you to <br className="md:hidden" />connect with</p>
          </div>
          <div className="bg-[#48EFBD] my-[15px] flex justify-center items-center flex-col md:ml-[50px] md:mt-[40px] rounded-[124px] w-[162px] h-[53px] xl:mt-0 xl:w-[227px] xl:h-[100px] xl:absolute xl:right-[176px] xl:top-[83px]">
            <p className="text-[#1D1D11] font-bold">UI/UX Design</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
          <div className="bg-[#7CB8FF] my-[15px] flex justify-center items-center flex-col rounded-[124px] w-[256px] h-[53px] xl:w-[300px] xl:h-[100px] xl:absolute xl:right-[475px] xl:top-[236px]">
            <p className="text-[#1D1D11] font-bold">Business Development</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
          <div className="bg-[#FFBF82] my-[15px] flex justify-center items-center flex-col md:mx-[30px] rounded-[124px] w-[132px] h-[53px] xl:mx-0 xl:w-[214px] xl:h-[99px] xl:absolute xl:right-[107px] xl:top-[386px]">
            <p className="text-[#1D1D11] font-bold">Marketing</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
          <div className="bg-[#FFDE4E] my-[15px] flex justify-center items-center flex-col rounded-[124px] w-[223px] h-[53px] xl:w-[292px] xl:h-[100px] xl:absolute xl:left-[521px] xl:top-[86px]">
            <p className="text-[#1D1D11] font-bold">Product Management</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
          <div className="bg-[#FF6397] my-[15px] flex justify-center items-center flex-col md:mb-[50px] rounded-[124px] w-[157px] h-[53px] xl:w-[224px] xl:h-[100px] xl:absolute xl:left-[250px] xl:top-[386px]">
            <p className="text-[#1D1D11] font-bold">Data Science</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
          <div className="bg-[#5DE5FF] my-[15px] flex justify-center items-center flex-col md:mb-[50px] md:mx-[30px] rounded-[124px] w-[256px] h-[53px] xl:mx-0 xl:w-[313px] xl:h-[100px] xl:absolute xl:right-[404px] xl:top-[386px]">
            <p className="text-[#1D1D11] font-bold">Software Development</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
          <div className="bg-[#CE8FFF] my-[15px] flex justify-center items-center flex-col md:mb-[50px] rounded-[124px] w-[203px] h-[53px] xl:w-[270px] xl:h-[99px] xl:absolute xl:right-[144px] xl:top-[236px]">
            <p className="text-[#1D1D11] font-bold">MarTech</p>
            <p className="text-[#1D1D11] font-light hidden xl:block">103 Mentors</p>
          </div>
        </div>
      </div>
      <div className="h-[987px] md:h-[780px] xl:h-[820px] flex w-full">
        <div className="w-[1280px] m-auto h-full flex flex-col justify-center items-center">
          <div className="flex">
            <Image src={landingPage_6} className="hidden w-[363px] xl:block" alt="1" />
            <div className="xl:ml-[78px]">
              <p className="text-[#003C5A] text-center xl:text-start font-bold text-2xl mt-1">成為 Mentor，你將可以‧‧‧</p>
              <div className="flex flex-col md:flex-row mt-[65px] md:items-center">
                <div className="flex mb-[60px] md:m-0 xl:w-[180px] md:flex-col items-center">
                  <Image className="ml-[40px] md:m-0" src={landingPage_icon_1} alt="1" />
                  <div className="ml-[30px] md:mt-[34px] md:ml-0 flex flex-col md:items-center">
                    <p className="text-[#1D1D1D] font-medium">分享經驗</p>
                    <p className="text-[#1D1D1D] font-medium">讓知識傳承延續</p>
                  </div>
                </div>
                <div className="flex mb-[60px] md:m-0 xl:w-[180px] md:flex-col items-center md:ml-[80px]">
                  <Image className="ml-[40px] md:m-0" src={landingPage_icon_2} alt="1" />
                  <div className="ml-[30px] md:mt-[34px] md:ml-0 h-[43px] flex flex-col md:items-center justify-center">
                    <p className="text-[#1D1D1D] font-medium">建立專屬人脈網絡</p>
                  </div>
                </div>
                <div className="flex xl:w-[180px] md:flex-col items-center md:ml-[80px]">
                  <Image className="ml-[40px] md:m-0" src={landingPage_icon_3} alt="1" />
                  <div className="ml-[30px] md:mt-[34px] md:ml-0 flex flex-col md:items-center">
                    <p className="text-[#1D1D1D] font-medium">增加社會影響力</p>
                    <p className="text-[#1D1D1D] font-medium">與他人共創美好價值</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex mt-[70px] md:mt-[116px]">
            <Image src={landingPage_7} className="hidden w-[363px] xl:block" alt="1" />
            <div className="xl:ml-[78px]">
              <p className="text-[#003C5A] text-center xl:text-start font-bold text-2xl mt-1">成為 Mentee，你將可以‧‧‧</p>
              <div className="flex flex-col md:flex-row mt-[65px] md:items-center">
                <div className="flex mb-[60px] md:m-0 xl:w-[180px] md:flex-col items-center">
                  <Image className="ml-[40px] md:m-0" src={landingPage_icon_4} alt="1" />
                  <div className="ml-[30px] md:mt-[34px] md:ml-0 flex flex-col md:items-center">
                    <p className="text-[#1D1D1D] font-medium">探索產業與</p>
                    <p className="text-[#1D1D1D] font-medium">職涯發展方向</p>
                  </div>
                </div>
                <div className="mb-[60px] md:m-0 flex xl:w-[180px] md:flex-col items-center md:ml-[80px]">
                  <Image className="ml-[45px] md:m-0" src={landingPage_icon_5} alt="1" />
                  <div className="ml-[35px] md:mt-[34px] md:ml-0 flex flex-col md:items-center justify-center">
                    <p className="text-[#1D1D1D] font-medium">與經驗豐富的 Mentor</p>
                    <p className="text-[#1D1D1D] font-medium">互動獲取第一手職涯秘笈</p>
                  </div>
                </div>
                <div className="flex xl:w-[180px] md:flex-col items-center md:ml-[80px]">
                  <Image className="ml-[45px] md:m-0" src={landingPage_icon_6} alt="1" />
                  <div className="ml-[30px] md:mt-[34px] md:ml-0 flex flex-col md:items-center">
                    <p className="text-[#1D1D1D] font-medium">學習更多學校沒教的事</p>
                    <p className="text-[#1D1D1D] font-medium">讓你快速成長</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#F8F8F8] h-[359px] md:h-[380px] flex w-full">
        <Swiper
          slidesPerView={1}
          spaceBetween={30}
          loop={true}
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
          }}
          modules={[Autoplay, Pagination]}
        >
          <SwiperSlide>
            <div className="m-auto flex flex-col md:flex-row items-center w-[520px] h-full">
              <div className="mt-[30px] mb-[10px] md:mr-10 flex md:flex-col items-center">
                <Image src={landingPage_2} className="w-[114px!important] h-[114px!important] rounded-full max-w-[unset] mb-4" alt="1" />
                <p className="text-[#003C5A] ml-3 w-max text-xl font-bold mb-1">Carolina</p>
              </div>
              <p className="text-[#1D1D1D] bg-[#F8F8F8] text-left text-base font-medium">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！
              </p>
            </div>
            <div className="hidden m-auto xl:flex flex-col md:flex-row items-center ml-[150px] w-[520px] h-full">
              <div className="mt-[30px] mb-[10px] md:mr-10 flex md:flex-col items-center">
                <Image src={landingPage_2} className="w-[114px!important] h-[114px!important] rounded-full max-w-[unset] mb-4" alt="1" />
                <p className="text-[#003C5A] ml-3 w-max text-xl font-bold mb-1">Carolina</p>
              </div>
              <p className="text-[#1D1D1D] bg-[#F8F8F8] text-left text-base font-medium">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！
              </p>
            </div>
          </SwiperSlide>
          <SwiperSlide>
            <div className="m-auto flex flex-col md:flex-row items-center w-[520px] h-full">
              <div className="mt-[30px] mb-[10px] md:mr-10 flex md:flex-col items-center">
                <Image src={landingPage_2} className="w-[114px!important] h-[114px!important] rounded-full max-w-[unset] mb-4" alt="1" />
                <p className="text-[#003C5A] ml-3 w-max text-xl font-bold mb-1">Carolina</p>
              </div>
              <p className="text-[#1D1D1D] bg-[#F8F8F8] text-left text-base font-medium">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！
              </p>
            </div>
            <div className="hidden m-auto xl:flex flex-col md:flex-row items-center ml-[150px] w-[520px] h-full">
              <div className="mt-[30px] mb-[10px] md:mr-10 flex md:flex-col items-center">
                <Image src={landingPage_2} className="w-[114px!important] h-[114px!important] rounded-full max-w-[unset] mb-4" alt="1" />
                <p className="text-[#003C5A] ml-3 w-max text-xl font-bold mb-1">Carolina</p>
              </div>
              <p className="text-[#1D1D1D] bg-[#F8F8F8] text-left text-base font-medium">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！
              </p>
            </div>
          </SwiperSlide>
          <SwiperSlide>
            <div className="m-auto flex flex-col md:flex-row items-center w-[520px] h-full">
              <div className="mt-[30px] mb-[10px] md:mr-10 flex md:flex-col items-center">
                <Image src={landingPage_2} className="w-[114px!important] h-[114px!important] rounded-full max-w-[unset] mb-4" alt="1" />
                <p className="text-[#003C5A] ml-3 w-max text-xl font-bold mb-1">Carolina</p>
              </div>
              <p className="text-[#1D1D1D] bg-[#F8F8F8] text-left text-base font-medium">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！
              </p>
            </div>
            <div className="hidden m-auto xl:flex flex-col md:flex-row items-center ml-[150px] w-[520px] h-full">
              <div className="mt-[30px] mb-[10px] md:mr-10 flex md:flex-col items-center">
                <Image src={landingPage_2} className="w-[114px!important] h-[114px!important] rounded-full max-w-[unset] mb-4" alt="1" />
                <p className="text-[#003C5A] ml-3 w-max text-xl font-bold mb-1">Carolina</p>
              </div>
              <p className="text-[#1D1D1D] bg-[#F8F8F8] text-left text-base font-medium">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過 XChange 與兩位厲害的前輩進行 coffee chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange 帶來的互聯網連結！
              </p>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
      <div className="flex items-center justify-center h-[215px] w-f">
        <button className="bg-[#00678C] w-[262px] h-[80px] md:w-[415px] md:h-[51px] rounded-md text-white text-xl font-bold tracking-[0.09em]">加入排隊名單，<br className="md:hidden" />搶先成為 X-Talent →</button>
      </div>
    </>
  )
}

export default Home;
