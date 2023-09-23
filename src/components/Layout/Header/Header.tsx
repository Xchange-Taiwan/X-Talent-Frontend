'use client';

import Image from 'next/image';
import Link from 'next/link';
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
    <header className="fixed inset-x-0 z-50 bg-white px-11 text-2xl">
      <div className="flex h-[70px] items-center justify-between">
        <Image src={logoImgUrl} alt="logo" />

        <div className="hidden gap-7 md:flex md:items-center">
          <Link href="/" className="font-['Open_Sans'] text-base text-black">
            首頁
          </Link>
          <Link
            href="/about"
            className="font-['Open_Sans'] text-base text-black"
          >
            關於 X-Talent
          </Link>
          <Link
            className="box-border h-10 rounded-md border-2 border-solid border-teal-blue bg-white px-6 py-2 text-base font-bold text-teal-blue"
            href="/signup"
          >
            註冊
          </Link>
          <Link
            className="h-10 rounded-md bg-teal-blue px-6 py-2 text-base font-bold  text-white"
            href="/login"
          >
            登入
          </Link>
        </div>

        <div className="md:hidden">
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
      </div>

      <dialog id="modal" className="modal modal-bottom sm:modal-middle">
        <form
          method="dialog"
          className="modal-box flex	h-full max-h-full flex-col items-center justify-center rounded-none"
        >
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

          <div className="mb-24 flex flex-col gap-12 text-center">
            <Link href="/" className="font-['Open_Sans'] text-xl text-black">
              首頁
            </Link>
            <Link
              href="/about"
              className="font-['Open_Sans'] text-xl  text-black"
            >
              關於 X-Talent
            </Link>
          </div>

          <div className="flex w-40 flex-col gap-8">
            <Link
              className="rounded-md bg-teal-blue px-6 py-2 text-center text-base font-bold text-white"
              href="/login"
            >
              登入
            </Link>
            <Link
              className="box-border h-10 rounded-md border-2 border-solid border-teal-blue bg-white px-6 py-2 text-center text-base font-bold  text-teal-blue"
              href="/signup"
            >
              註冊
            </Link>
          </div>
        </form>
      </dialog>
    </header>
  );
};
