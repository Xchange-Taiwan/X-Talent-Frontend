'use client';
import Image from 'next/image';
import { FC, ReactNode } from 'react';

import footerLogo from '../../../public/logo.png';
import logo from '../../../public/logo.svg';
import logoName from '../../../public/logoName.svg';

interface Props {
  children: ReactNode;
}

declare global {
  interface Window {
    modal: {
      showModal(): void;
    };
  }
}

const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <header className="fixed z-50 flex h-[70px] w-full items-center justify-between bg-white px-11 text-center text-2xl">
        <div className="flex">
          <Image src={logo} className="mr-3" alt="logo" />
          <Image src={logoName} alt="logoName" />
        </div>
        <div>
          <a
            href="/"
            className="mr-7 hidden font-['Open_Sans'] text-base text-black md:inline"
          >
            首頁
          </a>
          <a
            href="about"
            className="mr-7 hidden font-['Open_Sans'] text-base text-black md:inline"
          >
            關於 X-Talent
          </a>
          <button className="mr-7 hidden h-10 w-20 rounded-md border-2 border-solid border-teal-blue bg-white text-base font-bold text-teal-blue md:inline">
            註冊
          </button>
          <button className="hidden h-10 w-20 rounded-md bg-teal-blue text-base font-bold text-white md:inline">
            登入
          </button>
          <div className="flex-none md:hidden">
            <button
              onClick={() => window.modal.showModal()}
              className="btn btn-square btn-ghost"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block h-8 w-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
          </div>
          <dialog id="modal" className="modal modal-bottom sm:modal-middle">
            <form
              method="dialog"
              className="modal-box flex	h-full max-h-full flex-col items-center justify-center rounded-none"
            >
              <a
                href="/"
                className="font-['Open_Sans'] text-xl text-black md:inline md:hidden"
              >
                首頁
              </a>
              <a
                href="about"
                className="my-[30px] font-['Open_Sans'] text-xl text-black md:inline md:hidden"
              >
                關於 X-Talent
              </a>
              <button className="my-10 h-10 w-40 rounded-md bg-teal-blue text-base font-bold text-white md:hidden">
                登入
              </button>
              <button className="h-10 w-40 rounded-md border-2 border-solid border-teal-blue bg-white text-base font-bold text-teal-blue md:hidden">
                註冊
              </button>
              <div className="modal-action">
                <button className="btn btn-circle absolute right-5 top-5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </dialog>
        </div>
      </header>
      <main className="grow">{children}</main>
      <footer className="flex h-[730px] w-full bg-black md:h-[534px] xl:h-[290px]">
        <div className="flex h-full w-full flex-col px-[70px] pt-[50px] xl:flex-row xl:justify-between">
          <Image src={footerLogo} className="h-[39px] w-[146px]" alt="logo" />
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
    </div>
  );
};

export default Layout;
