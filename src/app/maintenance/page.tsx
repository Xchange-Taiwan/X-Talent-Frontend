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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-light px-6 py-12 text-center">
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
          <div className="absolute -inset-4 rounded-full bg-brand-500/10 blur-xl"></div>
          <div className="relative flex size-24 items-center justify-center rounded-2xl border border-background-border bg-background-white shadow-md">
            <Wrench className="size-12 animate-pulse text-brand-500" />
          </div>
          <div className="absolute -right-2 -bottom-2 flex size-10 items-center justify-center rounded-full border border-background-border bg-background-white shadow-sm">
            <Clock className="size-5 text-text-secondary" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          系統維護中
        </h1>

        {/* Subtitle / Description */}
        <p className="mb-8 text-sm leading-relaxed text-text-primary sm:text-base">
          為了提供更優質、穩定的服務，系統目前正在進行例行性維護。
          我們將於維護完成後立即恢復運作。造成您的不便，敬請見諒！
        </p>

        {/* Reload button */}
        <button
          onClick={handleReload}
          disabled={isReloading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold text-text-white shadow-sm transition-all hover:bg-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 ${isReloading ? 'animate-spin' : ''}`}
          />
          {isReloading ? '正在檢查...' : '重新整理試試'}
        </button>

        {/* Footer / Contact info */}
        <div className="mt-16 text-xs text-text-tertiary">
          © {new Date().getFullYear()} XChange. All rights reserved.
        </div>
      </div>
    </div>
  );
}
