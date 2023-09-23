'use client';

import Image from 'next/image';
import { FC } from 'react';

import logoImgUrl from './assets/logo.svg';

declare global {
  interface Window {
    modal: {
      showModal(): void;
    };
  }
}

export const Header: FC = () => {
  return (
    <header className="fixed z-50 flex h-[70px] w-full items-center justify-between bg-white px-11 text-center text-2xl">
      <div>
        <Image src={logoImgUrl} alt="logo" />
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
              className="font-['Open_Sans'] text-xl text-black md:hidden"
            >
              首頁
            </a>
            <a
              href="about"
              className="my-[30px] font-['Open_Sans'] text-xl  text-black md:hidden"
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
  );
};
