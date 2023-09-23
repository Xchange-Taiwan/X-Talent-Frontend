'use client';
import 'swiper/swiper.min.css';
import 'swiper/css/pagination';

import Image from 'next/image';
import React from 'react';
import { Autoplay, Pagination } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';

import landingPage_1 from '../../public/landingPage_1.png';
import landingPage_2 from '../../public/landingPage_2.png';
import landingPage_3 from '../../public/landingPage_3.png';
import landingPage_4 from '../../public/landingPage_4.png';
import landingPage_5 from '../../public/landingPage_5.png';
import landingPage_6 from '../../public/landingPage_6.png';
import landingPage_7 from '../../public/landingPage_7.png';
import landingPage_8 from '../../public/landingPage_8.png';
import landingPage_9 from '../../public/landingPage_9.png';
import landingPage_icon_1 from '../../public/landingPage_icon_1.svg';
import landingPage_icon_2 from '../../public/landingPage_icon_2.svg';
import landingPage_icon_3 from '../../public/landingPage_icon_3.svg';
import landingPage_icon_4 from '../../public/landingPage_icon_4.svg';
import landingPage_icon_5 from '../../public/landingPage_icon_5.svg';
import landingPage_icon_6 from '../../public/landingPage_icon_6.svg';
import landingPage_icon_7 from '../../public/landingPage_icon_7.svg';
import landingPage_icon_8 from '../../public/landingPage_icon_8.svg';
import landingPage_icon_9 from '../../public/landingPage_icon_9.png';
import landingPage_icon_10 from '../../public/landingPage_icon_10.svg';

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  return (
    <div className="mb-[50px] flex items-center md:w-2/4 md:flex-col xl:mx-[60px] xl:w-auto">
      <Image className="h-[70px] w-[70px]" src={icon} alt="1" />
      <p className="ml-[20px] text-xl tracking-[0.085em] md:mt-8">{text}</p>
    </div>
  );
};

const Home = () => {
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
      <div className="relative m-auto flex h-[670px] w-full items-center justify-center md:h-[735px] xl:max-w-screen-2xl">
        <div className="flex flex-col items-center md:w-[440px] xl:w-[600px]">
          <p className="mb-5 text-center text-5xl font-bold tracking-[0.17em] text-midnight-blue">
            交流讓
            <br className="md:hidden" />
            改變發生
          </p>
          <p className="text-center text-2xl font-bold text-black">
            Find your Mentor/Mentee to
            <br className="md:hidden" /> build up connections, break up{' '}
            <br className="md:hidden" />
            limits.
          </p>
        </div>
        <div className="absolute right-[-100px] top-[-150px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-coral-pink xl:right-[10px]"></div>
        <Image
          src={landingPage_1}
          className="absolute right-[-500px] w-52 rounded-full md:right-[-80px] md:top-[300px] xl:right-[50px] xl:top-[230px]"
          alt="1"
        />
        <div className="absolute right-[-40px] top-[380px] z-10 h-[261px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-purple md:right-[-80px] md:top-[450px] xl:right-[80px] xl:top-[370px]"></div>
        <div className="absolute right-[-500px] top-[530px] z-10 h-[181px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-orange xl:right-[-80px]"></div>
        <div className="absolute right-[-500px] top-[-30px] z-10 h-[460px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-blue xl:right-[-210px]"></div>
        <div className="absolute right-[-500px] top-[300px] z-10 h-[257px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-turquoise xl:right-[-260px]"></div>
        <Image
          src={landingPage_2}
          className="absolute left-[-300px] w-52 rounded-full md:left-[-70px] md:top-[500px] xl:left-[110px] xl:top-[440px]"
          alt="1"
        />
        <div className="absolute left-[-140px] top-[130px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-blue md:top-[235px] md:bg-orange xl:left-[-20px]"></div>
        <Image
          src={landingPage_3}
          className="absolute left-[-300px] top-[140px] w-36 rounded-full xl:left-[-70px]"
          alt="1"
        />
        <div className="absolute left-[-500px] top-[600px] z-10 h-[181px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-yellow xl:left-[50px]"></div>
        <div className="absolute left-[-500px] top-[720px] z-10 h-[439px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-blue xl:left-[-200px]"></div>
        <div className="absolute left-[-500px] top-[250px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-coral-pink xl:left-[-300px]"></div>
        <div className="absolute left-[-500px] top-[580px] z-10 h-[452px] w-24 rotate-45 overflow-hidden rounded-[124px] bg-purple xl:left-[-380px]"></div>
      </div>
      <div className="flex h-[661px] w-full">
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
      <div className="relative contents md:m-auto md:h-[1100px] md:w-[930px] xl:block xl:h-[790px]">
        <div className="mb-[50px] mt-[70px] flex flex-col items-center xl:mb-[130px] xl:mt-7 xl:flex-row">
          <Image src={landingPage_4} className="w-[420px]" alt="1" />
          <div className="m-auto flex w-[420px] flex-row flex-wrap p-[30px] md:mt-10 md:p-0 xl:w-full xl:flex-col xl:pl-[62px]">
            <p className="mb-5 text-2xl font-bold text-midnight-blue">
              和 X-Talent 一起拓展職涯的選擇性
            </p>
            <p className="text-xl text-black">
              聚集多種專業職能的資深前輩，分享產業洞見、職涯心法，協助建構更多元的角度與觀點。不論你是剛開始、還未開始，一起陪你把職涯走得更遠更寬闊。
            </p>
          </div>
        </div>
        <div className="mb-[50px] mt-7 flex flex-col-reverse items-center md:mb-[130px] xl:flex-row">
          <div className="m-auto flex w-[420px] flex-row flex-wrap p-[30px] md:mt-10 xl:w-full xl:flex-col xl:pr-[62px]">
            <p className="mb-5 text-2xl font-bold text-midnight-blue">
              透過 X-Talent 展開深度交流
            </p>
            <p className="text-xl text-black">
              透過 X-Talent 立即安排與 Mentor
              一對一的深度交流，讓你在尋求職涯建議、建立人脈上得到最直接的回饋。
            </p>
          </div>
          <Image src={landingPage_5} className="w-[420px]" alt="1" />
        </div>
      </div>
      <div className="flex h-[907px] w-full bg-dark-blue md:h-[425px] xl:h-[557px]">
        <div className="relative m-auto flex h-full flex-col justify-center md:w-[767px] md:flex-row md:flex-wrap md:items-center xl:w-[1280px]">
          <div className="my-[15px] w-auto text-4xl font-bold leading-[58px] text-white md:col-span-2 md:mt-[40px] xl:absolute xl:left-[60px] xl:top-[176px] xl:mt-0 ">
            <p>9000+ XChangers</p>
            <p>
              for you to <br className="md:hidden" />
              connect with
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[162px] flex-col items-center justify-center rounded-[124px] bg-[#48EFBD] md:ml-[50px] md:mt-[40px] xl:absolute xl:right-[176px] xl:top-[83px] xl:mt-0 xl:h-[100px] xl:w-[227px]">
            <p className="font-bold text-[#1D1D11]">UI/UX Design</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[256px] flex-col items-center justify-center rounded-[124px] bg-[#7CB8FF] xl:absolute xl:right-[475px] xl:top-[236px] xl:h-[100px] xl:w-[300px]">
            <p className="font-bold text-[#1D1D11]">Business Development</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[132px] flex-col items-center justify-center rounded-[124px] bg-[#FFBF82] md:mx-[30px] xl:absolute xl:right-[107px] xl:top-[386px] xl:mx-0 xl:h-[99px] xl:w-[214px]">
            <p className="font-bold text-[#1D1D11]">Marketing</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[223px] flex-col items-center justify-center rounded-[124px] bg-yellow xl:absolute xl:left-[521px] xl:top-[86px] xl:h-[100px] xl:w-[292px]">
            <p className="font-bold text-[#1D1D11]">Product Management</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[157px] flex-col items-center justify-center rounded-[124px] bg-pink md:mb-[50px] xl:absolute xl:left-[250px] xl:top-[386px] xl:h-[100px] xl:w-[224px]">
            <p className="font-bold text-[#1D1D11]">Data Science</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[256px] flex-col items-center justify-center rounded-[124px] bg-blue md:mx-[30px] md:mb-[50px] xl:absolute xl:right-[404px] xl:top-[386px] xl:mx-0 xl:h-[100px] xl:w-[313px]">
            <p className="font-bold text-[#1D1D11]">Software Development</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[203px] flex-col items-center justify-center rounded-[124px] bg-purple md:mb-[50px] xl:absolute xl:right-[144px] xl:top-[236px] xl:h-[99px] xl:w-[270px]">
            <p className="font-bold text-[#1D1D11]">MarTech</p>
            <p className="hidden font-light text-[#1D1D11] xl:block">
              103 Mentors
            </p>
          </div>
        </div>
      </div>
      <div className="flex h-[987px] w-full md:h-[780px] xl:h-[820px]">
        <div className="m-auto flex h-full w-[1280px] flex-col items-center justify-center">
          <div className="flex">
            <Image
              src={landingPage_6}
              className="hidden w-[363px] xl:block"
              alt="1"
            />
            <div className="xl:ml-[78px]">
              <p className="mt-1 text-center text-2xl font-bold text-midnight-blue xl:text-start">
                成為 Mentor，你將可以‧‧‧
              </p>
              <div className="mt-[65px] flex flex-col md:flex-row md:items-center">
                <div className="mb-[60px] flex items-center md:m-0 md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[40px] md:m-0"
                    src={landingPage_icon_1}
                    alt="1"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="font-medium text-black">分享經驗</p>
                    <p className="font-medium text-black">讓知識傳承延續</p>
                  </div>
                </div>
                <div className="mb-[60px] flex items-center md:m-0 md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[40px] md:m-0"
                    src={landingPage_icon_2}
                    alt="1"
                  />
                  <div className="ml-[30px] flex h-[43px] flex-col justify-center md:ml-0 md:mt-[34px] md:items-center">
                    <p className="font-medium text-black">建立專屬人脈網絡</p>
                  </div>
                </div>
                <div className="flex items-center md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[40px] md:m-0"
                    src={landingPage_icon_3}
                    alt="1"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="font-medium text-black">增加社會影響力</p>
                    <p className="font-medium text-black">與他人共創美好價值</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-[70px] flex md:mt-[116px]">
            <Image
              src={landingPage_7}
              className="hidden w-[363px] xl:block"
              alt="1"
            />
            <div className="xl:ml-[78px]">
              <p className="mt-1 text-center text-2xl font-bold text-midnight-blue xl:text-start">
                成為 Mentee，你將可以‧‧‧
              </p>
              <div className="mt-[65px] flex flex-col md:flex-row md:items-center">
                <div className="mb-[60px] flex items-center md:m-0 md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[40px] md:m-0"
                    src={landingPage_icon_4}
                    alt="1"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="font-medium text-black">探索產業與</p>
                    <p className="font-medium text-black">職涯發展方向</p>
                  </div>
                </div>
                <div className="mb-[60px] flex items-center md:m-0 md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[45px] md:m-0"
                    src={landingPage_icon_5}
                    alt="1"
                  />
                  <div className="ml-[35px] flex flex-col justify-center md:ml-0 md:mt-[34px] md:items-center">
                    <p className="font-medium text-black">
                      與經驗豐富的 Mentor
                    </p>
                    <p className="font-medium text-black">
                      互動獲取第一手職涯秘笈
                    </p>
                  </div>
                </div>
                <div className="flex items-center md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[45px] md:m-0"
                    src={landingPage_icon_6}
                    alt="1"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="font-medium text-black">
                      學習更多學校沒教的事
                    </p>
                    <p className="font-medium text-black">讓你快速成長</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-[359px] w-full bg-[#F8F8F8] md:h-[380px]">
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
            <div className="m-auto flex h-full w-[520px] flex-col items-center md:flex-row">
              <div className="mb-[10px] mt-[30px] flex items-center md:mr-10 md:flex-col">
                <Image
                  src={landingPage_8}
                  className="mb-4 h-[114px!important] w-[114px!important] max-w-[unset] rounded-full"
                  alt="1"
                />
                <p className="mb-1 w-max text-xl font-bold text-midnight-blue">
                  Carolina
                </p>
              </div>
              <p className="bg-[#F8F8F8] p-5 text-left text-base font-medium text-black">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過
                XChange 與兩位厲害的前輩進行 coffee
                chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange
                帶來的互聯網連結！
              </p>
            </div>
            <div className="m-auto ml-[150px] hidden h-full w-[520px] flex-col items-center md:flex-row xl:flex">
              <div className="mb-[10px] mt-[30px] flex items-center md:mr-10 md:flex-col">
                <Image
                  src={landingPage_9}
                  className="mb-4 h-[114px!important] w-[114px!important] max-w-[unset] rounded-full"
                  alt="1"
                />
                <p className="mb-1 w-max text-xl font-bold text-midnight-blue">
                  Pin-Hua Chen
                </p>
              </div>
              <p className="bg-[#F8F8F8] p-5 text-left text-base font-medium text-black">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過
                XChange 與兩位厲害的前輩進行 coffee
                chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange
                帶來的互聯網連結！
              </p>
            </div>
          </SwiperSlide>
          <SwiperSlide>
            <div className="m-auto flex h-full w-[520px] flex-col items-center md:flex-row">
              <div className="mb-[10px] mt-[30px] flex items-center md:mr-10 md:flex-col">
                <Image
                  src={landingPage_8}
                  className="mb-4 h-[114px!important] w-[114px!important] max-w-[unset] rounded-full"
                  alt="1"
                />
                <p className="mb-1 w-max text-xl font-bold text-midnight-blue">
                  Carolina
                </p>
              </div>
              <p className="bg-[#F8F8F8] p-5 text-left text-base font-medium text-black">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過
                XChange 與兩位厲害的前輩進行 coffee
                chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange
                帶來的互聯網連結！
              </p>
            </div>
            <div className="m-auto ml-[150px] hidden h-full w-[520px] flex-col items-center md:flex-row xl:flex">
              <div className="mb-[10px] mt-[30px] flex items-center md:mr-10 md:flex-col">
                <Image
                  src={landingPage_9}
                  className="mb-4 h-[114px!important] w-[114px!important] max-w-[unset] rounded-full"
                  alt="1"
                />
                <p className="mb-1 w-max text-xl font-bold text-midnight-blue">
                  Pin-Hua Chen
                </p>
              </div>
              <p className="bg-[#F8F8F8] p-5 text-left text-base font-medium text-black">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過
                XChange 與兩位厲害的前輩進行 coffee
                chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange
                帶來的互聯網連結！
              </p>
            </div>
          </SwiperSlide>
          <SwiperSlide>
            <div className="m-auto flex h-full w-[520px] flex-col items-center md:flex-row">
              <div className="mb-[10px] mt-[30px] flex items-center md:mr-10 md:flex-col">
                <Image
                  src={landingPage_8}
                  className="mb-4 h-[114px!important] w-[114px!important] max-w-[unset] rounded-full"
                  alt="1"
                />
                <p className="mb-1 w-max text-xl font-bold text-midnight-blue">
                  Carolina
                </p>
              </div>
              <p className="bg-[#F8F8F8] p-5 text-left text-base font-medium text-black">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過
                XChange 與兩位厲害的前輩進行 coffee
                chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange
                帶來的互聯網連結！
              </p>
            </div>
            <div className="m-auto ml-[150px] hidden h-full w-[520px] flex-col items-center md:flex-row xl:flex">
              <div className="mb-[10px] mt-[30px] flex items-center md:mr-10 md:flex-col">
                <Image
                  src={landingPage_9}
                  className="mb-4 h-[114px!important] w-[114px!important] max-w-[unset] rounded-full"
                  alt="1"
                />
                <p className="mb-1 w-max text-xl font-bold text-midnight-blue">
                  Pin-Hua Chen
                </p>
              </div>
              <p className="bg-[#F8F8F8] p-5 text-left text-base font-medium text-black">
                剛畢業時，曾有一段碰壁期，不只履歷被無聲卡，連冷郵件也毫無回音，後來透過
                XChange 與兩位厲害的前輩進行 coffee
                chat，不僅打開我對於職涯的想像，也重拾求職的動力，最後更獲得履歷內推的機會！謝謝XChange
                帶來的互聯網連結！
              </p>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
      <div className="w-f flex h-[215px] items-center justify-center">
        <button className="h-[80px] w-[262px] rounded-md bg-teal-blue text-xl font-bold tracking-[0.09em] text-white md:h-[51px] md:w-[415px]">
          加入排隊名單，
          <br className="md:hidden" />
          搶先成為 X-Talent →
        </button>
      </div>
    </>
  );
};

export default Home;
