import Image from 'next/image';
import { FC } from 'react';

import logoImgUrl from './assets/logo.png';

export const Footer: FC = () => {
  return (
    <footer className="flex h-[730px] w-full bg-dark md:h-[534px] xl:h-[290px]">
      <div className="flex h-full w-full flex-col px-[70px] pt-[50px] xl:flex-row xl:justify-between">
        <Image src={logoImgUrl} className="h-[39px] w-[146px]" alt="logo" />
        <div className="mt-[60px] text-[#FFFFFF] md:grid md:grid-cols-2 md:grid-rows-2 md:gap-x-4 xl:mt-0 xl:flex">
          <div className="mb-[58px] mr-[140px]">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              關於我們
            </p>
            <p className="font-normal">關於 XTalent</p>
          </div>
          <div className="mb-[58px] mr-[140px]">
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              相關連結
            </p>
            <p className="mb-3 font-normal">XChange Website</p>
            <p className="mb-3 font-normal">X-IMPACT Podcast</p>
            <p className="font-normal">XChange Medium</p>
          </div>
          <div>
            <p className="mb-5 text-xl font-bold tracking-[0.085em]">
              XChange 社群連結
            </p>
            <p className="mb-3 font-normal">Facebook 粉絲專頁</p>
            <p className="mb-3 font-normal">
              Facebook 社團｜XChange 互聯網 Coffee Room
            </p>
            <p className="font-normal">Instagram 商業檔案</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
