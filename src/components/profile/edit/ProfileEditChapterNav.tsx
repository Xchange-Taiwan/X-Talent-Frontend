'use client';

import React, { useCallback, useState } from 'react';

import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface ProfileEditChapterItem {
  id: string;
  label: string;
}

export function getProfileEditChapters(
  isMentor: boolean
): ProfileEditChapterItem[] {
  return [
    { id: 'basic-info', label: '基本資料' },
    { id: 'about', label: '關於我' },
    isMentor
      ? { id: 'mentor-expertise', label: '服務與專長' }
      : { id: 'mentee-preferences', label: '交流偏好' },
    { id: 'work_experiences', label: '工作經驗' },
    { id: 'educations', label: '教育經歷' },
    { id: 'links', label: '個人連結' },
  ];
}

export interface ProfileEditChapterNavProps {
  isMentor: boolean;
  activeChapterId?: string;
  onSelectChapter?: (chapterId: string) => void;
  className?: string;
}

export function ProfileEditChapterNav({
  isMentor,
  activeChapterId: controlledActiveId,
  onSelectChapter,
  className,
}: ProfileEditChapterNavProps) {
  const chapters = getProfileEditChapters(isMentor);
  const [internalActiveId, setInternalActiveId] = useState<string>(
    chapters[0].id
  );
  const activeId = controlledActiveId ?? internalActiveId;

  const handleSelect = useCallback(
    (chapterId: string) => {
      setInternalActiveId(chapterId);
      onSelectChapter?.(chapterId);
      if (typeof document !== 'undefined') {
        const target = document.getElementById(chapterId);
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }
    },
    [onSelectChapter]
  );

  return (
    <nav
      aria-label="編輯章節導覽"
      data-testid="profile-edit-chapter-nav"
      className={cn('w-full lg:w-52 lg:shrink-0 xl:w-56', className)}
    >
      <ul className="flex gap-2 overflow-x-auto p-1 lg:sticky lg:top-[152px] lg:flex-col lg:gap-1 lg:overflow-visible">
        {chapters.map((chapter) => {
          const isActive = activeId === chapter.id;
          return (
            <li key={chapter.id} className="shrink-0">
              <button
                type="button"
                aria-current={isActive ? 'location' : undefined}
                onClick={() => handleSelect(chapter.id)}
                className={cn(
                  FOCUS_RING_NO_OFFSET_CLASSES,
                  'flex w-full items-center rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-100/60 text-brand-700 font-semibold'
                    : 'text-text-secondary hover:bg-background-bottom-secondary hover:text-text-primary'
                )}
              >
                {chapter.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
