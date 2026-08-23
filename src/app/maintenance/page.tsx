'use client';

import { Clock, RefreshCw, Wrench } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import LogoImgUrl from '@/assets/logo.svg';

export default function MaintenancePage() {
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = () => {
    setIsReloading(true);
    // Reload and check the homepage
    window.location.href = '/';
  };

  return (
    <div className="bg-light fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex w-full max-w-md flex-col items-center">
        {/* Logo */}
        <div className="mb-12">
          <Image
            src={LogoImgUrl}
            alt="XChange Logo"
            width={160}
            height={40}
            priority
          />
        </div>

        {/* Visual Illustration / Icons */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="bg-brand-500/10 absolute -inset-4 rounded-full blur-xl"></div>
          <div className="border-background-border bg-background-white relative flex size-24 items-center justify-center rounded-2xl border shadow-md">
            <Wrench className="text-brand-500 size-12 animate-pulse" />
          </div>
          <div className="border-background-border bg-background-white absolute -right-2 -bottom-2 flex size-10 items-center justify-center rounded-full border shadow-sm">
            <Clock className="text-text-secondary size-5" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-navy mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
          系統維護中
        </h1>

        {/* Subtitle / Description */}
        <p className="text-text-primary mb-8 text-sm leading-relaxed sm:text-base">
          為了提供更優質、穩定的服務，系統目前正在進行例行性維護。
          我們將於維護完成後立即恢復運作。造成您的不便，敬請見諒！
        </p>

        {/* Reload button */}
        <button
          onClick={handleReload}
          disabled={isReloading}
          className="bg-brand-500 text-text-white hover:bg-brand-600 focus:ring-brand-500 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 ${isReloading ? 'animate-spin' : ''}`}
          />
          {isReloading ? '正在檢查...' : '重新整理試試'}
        </button>

        {/* Footer / Contact info */}
        <div className="text-text-tertiary mt-16 text-xs">
          © {new Date().getFullYear()} XChange. All rights reserved.
        </div>
      </div>
    </div>
  );
}
