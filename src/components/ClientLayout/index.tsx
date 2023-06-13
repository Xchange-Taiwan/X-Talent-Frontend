import Image from 'next/image'
import { FC, ReactNode } from 'react';

import footerLogo from '../../../public/logo.png';
import logo from '../../../public/logo.svg';
import logoName from '../../../public/logoName.svg';

interface Props {
  children: ReactNode;
}

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <header className="bg-white flex text-center text-2xl h-[70px] fixed w-full items-center justify-between px-11 z-50">
        <div className="flex">
          <Image src={logo} className="mr-3" alt="logo" />
          <Image src={logoName} alt="logoName" />
        </div>
        <div>
          <span className="text-black hidden md:inline text-base mr-7 font-['Open_Sans']">關於 X-Talent</span>
          <button className="bg-white hidden md:inline rounded-md w-20 h-10 text-base font-bold text-teal-blue border-solid border-2 border-teal-blue mr-7">註冊</button>
          <button className="bg-teal-blue hidden md:inline rounded-md w-20 h-10 text-base font-bold text-white">登入</button>
        </div>
      </header>
      <main className="grow">{children}</main>
      <footer className="bg-black h-[730px] md:h-[534px] xl:h-[290px] flex w-full">
        <div className="w-full h-full pt-[50px] px-[70px] flex flex-col xl:justify-between xl:flex-row">
          <Image src={footerLogo} className="w-[146px] h-[39px]" alt="logo" />
          <div className="text-[#FFFFFF] mt-[60px] md:gap-x-4 md:grid md:grid-cols-2 md:grid-rows-2 xl:mt-0 xl:flex">
            <div className="mr-[140px] mb-[58px]">
              <p className="text-xl font-bold mb-5 tracking-[0.085em]">關於我們</p>
              <p className="font-normal">關於 XTalent</p>
            </div>
            <div className="mr-[140px] mb-[58px]">
              <p className="text-xl font-bold mb-5 tracking-[0.085em]">相關連結</p>
              <p className="font-normal mb-3">XChange Website</p>
              <p className="font-normal mb-3">X-IMPACT Podcast</p>
              <p className="font-normal">XChange Medium</p>
            </div>
            <div>
              <p className="text-xl font-bold mb-5 tracking-[0.085em]">XChange 社群連結</p>
              <p className="font-normal mb-3">Facebook 粉絲專頁</p>
              <p className="font-normal mb-3">Facebook 社團｜XChange 互聯網 Coffee Room</p>
              <p className="font-normal">Instagram 商業檔案</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
