import { Home, Search } from 'lucide-react';
import Link from 'next/link';

import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="border-background-border bg-background-white flex w-full max-w-md flex-col items-center rounded-2xl border px-6 py-10 text-center shadow-sm">
        <span className="text-brand-500 mb-2 text-sm font-bold tracking-wider">
          404
        </span>
        <h1 className="text-navy mb-2 text-2xl font-bold">找不到此頁面</h1>
        <p className="text-text-secondary mb-6 text-sm leading-relaxed">
          您造訪的連結可能已變更或不存在，請返回首頁或前往探索導師。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className={cn(
              'bg-brand-500 text-text-white hover:bg-brand-600 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none',
              FOCUS_RING_CLASSES
            )}
          >
            <Home className="size-4" aria-hidden="true" />
            返回首頁
          </Link>
          <Link
            href="/mentor-pool"
            className={cn(
              'border-background-border bg-background-white text-text-primary hover:bg-light inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none',
              FOCUS_RING_CLASSES
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            探索導師
          </Link>
        </div>
      </div>
    </main>
  );
}
