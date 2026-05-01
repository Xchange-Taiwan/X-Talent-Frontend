import type { Metadata } from 'next';
import Image from 'next/image';

import HomePageHeroImgUrl from '@/assets/landing/home-page-hero.webp';
import landingPage_4 from '@/assets/landing/landingPage_4.webp';
import landingPage_5 from '@/assets/landing/landingPage_5.webp';
import landingPage_6 from '@/assets/landing/landingPage_6.webp';
import landingPage_7 from '@/assets/landing/landingPage_7.webp';
import landingPage_icon_1 from '@/assets/landing/landingPage_icon_1.svg';
import landingPage_icon_2 from '@/assets/landing/landingPage_icon_2.svg';
import landingPage_icon_3 from '@/assets/landing/landingPage_icon_3.svg';
import landingPage_icon_4 from '@/assets/landing/landingPage_icon_4.svg';
import landingPage_icon_5 from '@/assets/landing/landingPage_icon_5.svg';
import landingPage_icon_6 from '@/assets/landing/landingPage_icon_6.svg';
import { HomePageSliderClient } from '@/components/landing/HomePageSliderClient';

import { featureData } from './data';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
  return (
    <div className="mb-6 flex items-center md:mb-[50px] md:w-2/4 md:flex-col xl:mx-[60px] xl:w-auto">
      <Image
        className="h-12 w-12 md:h-[70px] md:w-[70px]"
        src={icon}
        alt=""
        role="presentation"
      />
      <p className="ml-[20px] text-base tracking-[0.085em] md:mt-8 md:text-xl">
        {text}
      </p>
    </div>
  );
};

export default function Page() {
  return (
    <>
      <section className="flex h-[532px] flex-col items-center justify-center bg-[url('/landing/home-page-hero-sm.svg')] bg-cover bg-no-repeat px-4 text-center sm:bg-[url('/landing/home-page-hero-md.svg')] sm:px-0 lg:h-[640px] lg:bg-none">
        <h1 className="text-blue-950 mb-8 text-3xl font-bold leading-normal sm:text-4xl md:text-5xl">
          交流讓
          <br className="md:hidden" />
          改變發生
        </h1>
        <p className="text-black max-w-[516px] text-lg sm:text-xl md:text-2xl lg:max-w-[630px]">
          Find your Mentor/Mentee to build up connections, break up limits.
        </p>

        <Image
          src={HomePageHeroImgUrl}
          alt="X-Talent 平台主視覺：專業工作者交流情境"
          fill
          sizes="1800px"
          priority
          className="-z-10 hidden w-[1800px] object-cover object-top lg:block"
        />
      </section>

      <section className="flex py-10  sm:py-20">
        <div className="flex w-full flex-col items-center justify-center">
          <h2 className="text-midnight-blue mb-[30px] text-center text-xl font-bold tracking-[0.04em] md:mb-[70px] md:text-2xl">
            透過 X-Talent 創造你
            <br className="md:hidden" />
            的職涯可能性
          </h2>
          <div className="text-black flex flex-col flex-wrap justify-center font-bold md:flex-row">
            {featureData.map((item) => (
              <FeatureItem key={item.text} icon={item.icon} text={item.text} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative contents md:m-auto md:h-[1100px] md:w-[930px] xl:block xl:h-[790px] ">
        <div className="mb-[50px] mt-8 flex flex-col items-center px-4 min-[550px]:px-14 md:mt-[70px] md:flex-row md:items-start md:gap-8 md:px-8 xl:mb-[130px] xl:mt-7 xl:gap-0 xl:px-0">
          <Image
            src={landingPage_4}
            width={420}
            height={270}
            alt="Mentor 與 Mentee 線上交流情境"
            sizes="(min-width: 768px) 40vw, 420px"
            className="max-w-full shrink-0 md:w-2/5"
          />
          <div className="m-auto flex flex-col py-[30px] md:m-0 md:flex-1 md:py-0 xl:pl-[62px]">
            <h2 className="text-midnight-blue mb-5 text-xl font-bold md:text-2xl">
              和 X-Talent 一起拓展職涯的選擇性
            </h2>
            <p className="text-black text-base md:text-xl">
              聚集多種專業職能的資深前輩，分享產業洞見、職涯心法，協助建構更多元的角度與觀點。不論你是剛開始、還未開始，一起陪你把職涯走得更遠更寬闊。
            </p>
          </div>
        </div>
        <div className="mb-[50px] mt-7 flex flex-col-reverse items-center px-4 min-[550px]:px-14 md:mb-[130px] md:flex-row md:items-start md:gap-8 md:px-8 xl:gap-0 xl:px-0">
          <div className="m-auto flex flex-col py-[30px] md:m-0 md:flex-1 md:py-0 xl:pr-[62px]">
            <h2 className="text-midnight-blue mb-5 text-xl font-bold md:text-2xl">
              透過 X-Talent 展開深度交流
            </h2>
            <p className="text-black text-base md:text-xl">
              透過 X-Talent 立即安排與 Mentor
              一對一的深度交流，讓你在尋求職涯建議、建立人脈上得到最直接的回饋。
            </p>
          </div>
          <Image
            src={landingPage_5}
            alt="Mentor 一對一指導 Mentee 情境"
            sizes="(min-width: 768px) 40vw, 100vw"
            className="max-w-full shrink-0 md:w-2/5"
          />
        </div>
      </section>

      <section className="flex h-auto w-full bg-[#172E59] py-12 md:h-[425px] md:py-0 xl:h-[557px]">
        <div className="relative m-auto flex h-auto flex-col items-center px-6 md:h-full md:w-[767px] md:flex-row md:flex-wrap md:items-center md:justify-center md:px-0 xl:w-[1280px]">
          <div className="my-[15px] w-auto text-center text-2xl font-bold leading-tight text-light md:col-span-2 md:mt-[40px] md:text-left md:text-4xl md:leading-[58px] xl:absolute xl:left-[60px] xl:top-[176px] xl:mt-0">
            <p>9000+ XChangers</p>
            <p>
              for you to <br className="md:hidden" />
              connect with
            </p>
          </div>
          <div className="my-2 flex h-[53px] w-[162px] flex-col items-center justify-center rounded-[124px] bg-[#48EFBD] md:my-[15px] md:ml-[50px] md:mt-[40px] xl:absolute xl:right-[176px] xl:top-[83px] xl:mt-0 xl:h-[100px] xl:w-[227px]">
            <p className="font-bold text-[#1D1D11]">UI/UX Design</p>
          </div>
          <div className="my-2 flex h-[53px] w-[256px] flex-col items-center justify-center rounded-[124px] bg-[#7CB8FF] md:my-[15px] xl:absolute xl:right-[475px] xl:top-[236px] xl:h-[100px] xl:w-[300px]">
            <p className="font-bold text-[#1D1D11]">Business Development</p>
          </div>
          <div className="my-2 flex h-[53px] w-[132px] flex-col items-center justify-center rounded-[124px] bg-[#FFBF82] md:mx-[30px] md:my-[15px] xl:absolute xl:right-[107px] xl:top-[386px] xl:mx-0 xl:h-[99px] xl:w-[214px]">
            <p className="font-bold text-[#1D1D11]">Marketing</p>
          </div>
          <div className="my-2 flex h-[53px] w-[223px] flex-col items-center justify-center rounded-[124px] bg-[#FFDE4E] md:my-[15px] xl:absolute xl:left-[521px] xl:top-[86px] xl:h-[100px] xl:w-[292px]">
            <p className="font-bold text-[#1D1D11]">Product Management</p>
          </div>
          <div className="my-2 flex h-[53px] w-[157px] flex-col items-center justify-center rounded-[124px] bg-[#FF6397] md:my-[15px] md:mb-[50px] xl:absolute xl:left-[250px] xl:top-[386px] xl:h-[100px] xl:w-[224px]">
            <p className="font-bold text-[#1D1D11]">Data Science</p>
          </div>
          <div className="my-2 flex h-[53px] w-[256px] flex-col items-center justify-center rounded-[124px] bg-[#5EE5FF] md:mx-[30px] md:my-[15px] md:mb-[50px] xl:absolute xl:right-[404px] xl:top-[386px] xl:mx-0 xl:h-[100px] xl:w-[313px]">
            <p className="font-bold text-[#1D1D11]">Software Development</p>
          </div>
          <div className="my-2 flex h-[53px] w-[203px] flex-col items-center justify-center rounded-[124px] bg-[#CE8FFF] md:my-[15px] md:mb-[50px] xl:absolute xl:right-[144px] xl:top-[236px] xl:h-[99px] xl:w-[270px]">
            <p className="font-bold text-[#1D1D11]">MarTech</p>
          </div>
        </div>
      </section>

      <section className="flex h-auto w-full py-10 md:h-[780px] md:py-0 xl:h-[820px]">
        <div className="m-auto flex h-auto w-full max-w-[1280px] flex-col items-center justify-center px-4 md:h-full md:px-8 xl:px-0">
          <div className="flex">
            <Image
              src={landingPage_6}
              alt="成為 Mentor 主視覺"
              sizes="363px"
              className="hidden w-[363px] xl:block"
            />
            <div className="xl:ml-[78px]">
              <h2 className="text-midnight-blue mt-1 text-center text-xl font-bold md:text-2xl xl:text-start">
                成為 Mentor，你將可以‧‧‧
              </h2>
              <div className="mt-8 flex flex-col md:mt-[65px] md:flex-row md:items-center">
                <div className="mb-6 flex items-center md:m-0 md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-4 md:m-0"
                    src={landingPage_icon_1}
                    alt=""
                    role="presentation"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">分享經驗</p>
                    <p className="text-black font-medium">讓知識傳承延續</p>
                  </div>
                </div>
                <div className="mb-6 flex items-center md:m-0 md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-4 md:m-0"
                    src={landingPage_icon_2}
                    alt=""
                    role="presentation"
                  />
                  <div className="ml-[30px] flex h-[43px] flex-col justify-center md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">建立專屬人脈網絡</p>
                  </div>
                </div>
                <div className="flex items-center md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-4 md:m-0"
                    src={landingPage_icon_3}
                    alt=""
                    role="presentation"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">增加社會影響力</p>
                    <p className="text-black font-medium">與他人共創美好價值</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 flex md:mt-[116px]">
            <Image
              src={landingPage_7}
              alt="成為 Mentee 主視覺"
              sizes="363px"
              className="hidden w-[363px] xl:block"
            />
            <div className="xl:ml-[78px]">
              <h2 className="text-midnight-blue mt-1 text-center text-xl font-bold md:text-2xl xl:text-start">
                成為 Mentee，你將可以‧‧‧
              </h2>
              <div className="mt-8 flex flex-col md:mt-[65px] md:flex-row md:items-center">
                <div className="mb-6 flex items-center md:m-0 md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-4 md:m-0"
                    src={landingPage_icon_4}
                    alt=""
                    role="presentation"
                  />
                  <div className="ml-[30px] flex flex-col md:ml-0 md:mt-[34px] md:items-center">
                    <p className="text-black font-medium">探索產業與</p>
                    <p className="text-black font-medium">職涯發展方向</p>
                  </div>
                </div>
                <div className="mb-6 flex items-center md:m-0 md:ml-[80px] md:flex-col xl:w-[180px]">
                  <Image
                    className="ml-4 md:m-0"
                    src={landingPage_icon_5}
                    alt=""
                    role="presentation"
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
                    className="ml-4 md:m-0"
                    src={landingPage_icon_6}
                    alt=""
                    role="presentation"
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
          <HomePageSliderClient />
        </div>
      </section>
    </>
  );
}
