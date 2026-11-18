import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditPageHeader } from './EditPageHeader';

describe('EditPageHeader (#959)', () => {
  it('renders Mentee role subtitle, title, and triggers onBack on 取消 click', () => {
    const onBack = vi.fn();
    render(
      <EditPageHeader isSaving={false} onBack={onBack} isMentor={false} />
    );

    expect(screen.getByText('學員個人資料')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '編輯個人資訊' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '儲存變更' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders Mentor edit and Mentor onboarding subtitles, titles, and CTA labels', () => {
    const { rerender } = render(
      <EditPageHeader isSaving={false} onBack={vi.fn()} isMentor={true} />
    );
    expect(screen.getByText('導師個人資料')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '編輯導師資料' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '儲存變更' })
    ).toBeInTheDocument();

    rerender(
      <EditPageHeader
        isSaving={false}
        onBack={vi.fn()}
        isMentor={false}
        isMentorOnboarding={true}
      />
    );
    expect(screen.getByText('導師個人資料')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '建立導師資料' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '儲存並建立' })
    ).toBeInTheDocument();
  });
});
