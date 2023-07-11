'use client';
import Image from 'next/image'
import { FC, ReactNode } from 'react';

import footerLogo from '../../../public/logo.png';
import logo from '../../../public/logo.svg';
import logoName from '../../../public/logoName.svg';

interface Props {
  children: ReactNode;
}

declare global {
  interface Window {
    "modal": {
      showModal(): void;
    }
  }
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
          <a href="/" className="text-black hidden md:inline text-base mr-7 font-['Open_Sans']">首頁</a>
          <a href="about" className="text-black hidden md:inline text-base mr-7 font-['Open_Sans']">關於 X-Talent</a>
          <button className="bg-white hidden md:inline rounded-md w-20 h-10 text-base font-bold text-teal-blue border-solid border-2 border-teal-blue mr-7">註冊</button>
          <button className="bg-teal-blue hidden md:inline rounded-md w-20 h-10 text-base font-bold text-white">登入</button>
          <div className="flex-none md:hidden">
            <button onClick={() => window.modal.showModal()} className="btn btn-square btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>
          <dialog id="modal" className="modal modal-bottom sm:modal-middle">
            <form method="dialog" className="modal-box rounded-none	h-full max-h-full flex flex-col items-center justify-center">
              <a href="/" className="text-black md:hidden md:inline text-xl font-['Open_Sans']">首頁</a>
              <a href="about" className="text-black my-[30px] md:hidden md:inline text-xl font-['Open_Sans']">關於 X-Talent</a>
              <button className="bg-teal-blue md:hidden rounded-md w-40 my-10 h-10 text-base font-bold text-white">登入</button>
              <button className="bg-white md:hidden rounded-md w-40 h-10 text-base font-bold text-teal-blue border-solid border-2 border-teal-blue">註冊</button>
              <div className="modal-action">
                <button className="btn btn-circle absolute top-5 right-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </form>
          </dialog>
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
