'use client';
import Image from 'next/image';

import HomePageHeroImgUrl from '@/assets/landing/home-page-hero.png';
import landingPage_4 from '@/assets/landing/landingPage_4.png';
import landingPage_5 from '@/assets/landing/landingPage_5.png';
import landingPage_6 from '@/assets/landing/landingPage_6.png';
import landingPage_7 from '@/assets/landing/landingPage_7.png';
import landingPage_icon_1 from '@/assets/landing/landingPage_icon_1.svg';
import landingPage_icon_2 from '@/assets/landing/landingPage_icon_2.svg';
import landingPage_icon_3 from '@/assets/landing/landingPage_icon_3.svg';
import landingPage_icon_4 from '@/assets/landing/landingPage_icon_4.svg';
import landingPage_icon_5 from '@/assets/landing/landingPage_icon_5.svg';
import landingPage_icon_6 from '@/assets/landing/landingPage_icon_6.svg';
import landingPage_icon_7 from '@/assets/landing/landingPage_icon_7.svg';
import landingPage_icon_8 from '@/assets/landing/landingPage_icon_8.svg';
import landingPage_icon_9 from '@/assets/landing/landingPage_icon_9.png';
import landingPage_icon_10 from '@/assets/landing/landingPage_icon_10.svg';
import { HomePageSlider } from '@/components/landing/HomePageSlider';
import { JoinWaitingList } from '@/components/landing/JoinWaitingList';
import { SCREEN_SIZE } from '@/constant/theme';
import useWindowSize from '@/hooks/useWindowSize';

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

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  return (
    <div className="mb-[50px] flex items-center md:w-2/4 md:flex-col xl:mx-[60px] xl:w-auto">
      <Image className="h-[70px] w-[70px]" src={icon} alt="1" />
      <p className="ml-[20px] text-xl tracking-[0.085em] md:mt-8">{text}</p>
    </div>
  );
};

const Home = () => {
  const { width } = useWindowSize();

  return (
    <>
      <section className="flex h-[532px] items-center justify-center bg-[url('/landing/home-page-hero-sm.svg')] bg-cover bg-no-repeat px-4 sm:bg-[url('/landing/home-page-hero-md.svg')] sm:px-0 lg:h-[640px] lg:bg-none">
        <h1 className="text-center">
          <p className="text-blue-950 mb-8 text-5xl font-bold leading-normal">
            交流讓
            <br className="md:hidden" />
            改變發生
          </p>
          <p className="text-black max-w-[516px] text-2xl lg:max-w-[630px]">
            Find your Mentor/Mentee to build up connections, break up limits.
          </p>
        </h1>

        {width > SCREEN_SIZE.lg && (
          <Image
            src={HomePageHeroImgUrl}
            alt="Hero Section"
            fill
            className="-z-10 w-[1800px] object-cover object-top"
          />
        )}
      </section>

      <section className="flex py-10  sm:py-20">
        <div className="flex w-full flex-col items-center justify-center">
          <p className="text-midnight-blue mb-[30px] text-center text-2xl font-bold tracking-[0.04em] md:mb-[70px]">
            透過 X -Talent 創造你
            <br className="md:hidden" />
            的職涯可能性
          </p>
          <div className="text-black flex flex-col flex-wrap justify-center font-bold md:flex-row">
            {featureData.map((item, index) => (
              <FeatureItem key={index} icon={item.icon} text={item.text} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 text-center sm:py-10">
        <JoinWaitingList>
          <p className="text-xl">
            加入排隊名單， <br className="md:hidden" />
            搶先成為 X-Talent →
          </p>
        </JoinWaitingList>
      </section>

      <section className="relative contents md:m-auto md:h-[1100px] md:w-[930px] xl:block xl:h-[790px] ">
        <div className="mb-[50px] mt-[70px] flex flex-col items-center xl:mb-[130px] xl:mt-7 xl:flex-row">
          <Image src={landingPage_4} width={420} height={270} alt="1" />
          <div className="m-auto flex flex-row flex-wrap p-[30px] px-4 sm:px-0 md:mt-10 md:p-0 xl:w-full xl:flex-col xl:pl-[62px]">
            <p className="text-midnight-blue mb-5 text-2xl font-bold">
              和 X-Talent 一起拓展職涯的選擇性
            </p>
            <p className="text-black text-xl">
              聚集多種專業職能的資深前輩，分享產業洞見、職涯心法，協助建構更多元的角度與觀點。不論你是剛開始、還未開始，一起陪你把職涯走得更遠更寬闊。
            </p>
          </div>
        </div>
        <div className="mb-[50px] mt-7 flex flex-col-reverse items-center md:mb-[130px] xl:flex-row">
          <div className="m-auto flex flex-row flex-wrap p-[30px] px-4 sm:px-0 md:mt-10 xl:w-full xl:flex-col xl:pr-[62px]">
            <p className="text-midnight-blue mb-5 text-2xl font-bold">
              透過 X-Talent 展開深度交流
            </p>
            <p className="text-black text-xl">
              透過 X-Talent 立即安排與 Mentor
              一對一的深度交流，讓你在尋求職涯建議、建立人脈上得到最直接的回饋。
            </p>
          </div>
          <Image src={landingPage_5} className="w-[420px]" alt="1" />
        </div>
      </section>

      <section className="flex h-[907px] w-full bg-[#172E59] md:h-[425px] xl:h-[557px]">
        <div className="relative m-auto flex h-full flex-col justify-center md:w-[767px] md:flex-row md:flex-wrap md:items-center xl:w-[1280px]">
          <div className="my-[15px] w-auto text-4xl font-bold leading-[58px] text-light md:col-span-2 md:mt-[40px] xl:absolute xl:left-[60px] xl:top-[176px] xl:mt-0 ">
            <p>9000+ XChangers</p>
            <p>
              for you to <br className="md:hidden" />
              connect with
            </p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[162px] flex-col items-center justify-center rounded-[124px] bg-[#48EFBD] md:ml-[50px] md:mt-[40px] xl:absolute xl:right-[176px] xl:top-[83px] xl:mt-0 xl:h-[100px] xl:w-[227px]">
            <p className="font-bold text-[#1D1D11]">UI/UX Design</p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[256px] flex-col items-center justify-center rounded-[124px] bg-[#7CB8FF] xl:absolute xl:right-[475px] xl:top-[236px] xl:h-[100px] xl:w-[300px]">
            <p className="font-bold text-[#1D1D11]">Business Development</p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[132px] flex-col items-center justify-center rounded-[124px] bg-[#FFBF82] md:mx-[30px] xl:absolute xl:right-[107px] xl:top-[386px] xl:mx-0 xl:h-[99px] xl:w-[214px]">
            <p className="font-bold text-[#1D1D11]">Marketing</p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[223px] flex-col items-center justify-center rounded-[124px] bg-[#FFDE4E] xl:absolute xl:left-[521px] xl:top-[86px] xl:h-[100px] xl:w-[292px]">
            <p className="font-bold text-[#1D1D11]">Product Management</p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[157px] flex-col items-center justify-center rounded-[124px] bg-[#FF6397] md:mb-[50px] xl:absolute xl:left-[250px] xl:top-[386px] xl:h-[100px] xl:w-[224px]">
            <p className="font-bold text-[#1D1D11]">Data Science</p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[256px] flex-col items-center justify-center rounded-[124px] bg-[#5EE5FF] md:mx-[30px] md:mb-[50px] xl:absolute xl:right-[404px] xl:top-[386px] xl:mx-0 xl:h-[100px] xl:w-[313px]">
            <p className="font-bold text-[#1D1D11]">Software Development</p>
          </div>
          <div className="my-[15px] flex h-[53px] w-[203px] flex-col items-center justify-center rounded-[124px] bg-[#CE8FFF] md:mb-[50px] xl:absolute xl:right-[144px] xl:top-[236px] xl:h-[99px] xl:w-[270px]">
            <p className="font-bold text-[#1D1D11]">MarTech</p>
          </div>
        </div>
      </section>

      <section className="flex h-[987px] w-full md:h-[780px] xl:h-[820px]">
        <div className="m-auto flex h-full w-[1280px] flex-col items-center justify-center">
          <div className="flex">
            <Image
              src={landingPage_6}
              className="hidden w-[363px] xl:block"
              alt="1"
            />
            <div className="xl:ml-[78px]">
              <p className="text-midnight-blue mt-1 text-center text-2xl font-bold xl:text-start">
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
                    <p className="text-black font-medium">分享經驗</p>
                    <p className="text-black font-medium">讓知識傳承延續</p>
                  </div>
                </div>
                <div className="mb-[60px] flex items-center md:m-0 md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[40px] md:m-0"
                    src={landingPage_icon_2}
                    alt="1"
                  />
                  <div className="ml-[30px] flex h-[43px] flex-col justify-center md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">建立專屬人脈網絡</p>
                  </div>
                </div>
                <div className="flex items-center md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[40px] md:m-0"
                    src={landingPage_icon_3}
                    alt="1"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">增加社會影響力</p>
                    <p className="text-black font-medium">與他人共創美好價值</p>
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
              <p className="text-midnight-blue mt-1 text-center text-2xl font-bold xl:text-start">
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
                    <p className="text-black font-medium">探索產業與</p>
                    <p className="text-black font-medium">職涯發展方向</p>
                  </div>
                </div>
                <div className="mb-[60px] flex items-center md:m-0 md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-[45px] md:m-0"
                    src={landingPage_icon_5}
                    alt="1"
                  />
                  <div className="ml-[35px] flex flex-col justify-center md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">
                      與經驗豐富的 Mentor
                    </p>
                    <p className="text-black font-medium">
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
                    <p className="text-black font-medium">
                      學習更多學校沒教的事
                    </p>
                    <p className="text-black font-medium">讓你快速成長</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-[600px] py-10 lg:max-w-6xl">
          <HomePageSlider />
        </div>
      </section>

      <section className="py-24 text-center">
        <JoinWaitingList>
          <p className="text-xl">
            加入排隊名單， <br className="md:hidden" />
            搶先成為 X-Talent →
          </p>
        </JoinWaitingList>
      </section>
    </>
  );
};

export default Home;
