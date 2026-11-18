import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProfileEditChapterNav } from './ProfileEditChapterNav';

describe('ProfileEditChapterNav (#959)', () => {
  it('renders Mentor chapter labels with 服務與專長 and scrolls to clicked target', () => {
    const scrollSpy = vi.fn();
    const target = document.createElement('div');
    target.id = 'mentor-expertise';
    target.scrollIntoView = scrollSpy;
    document.body.appendChild(target);

    try {
      render(<ProfileEditChapterNav isMentor={true} />);

      expect(
        screen.getByRole('button', { name: '服務與專長' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '交流偏好' })
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '服務與專長' }));
      expect(scrollSpy).toHaveBeenCalledTimes(1);
    } finally {
      document.body.removeChild(target);
    }
  });

  it('renders Mentee chapter labels with 交流偏好', () => {
    render(<ProfileEditChapterNav isMentor={false} />);

    expect(
      screen.getByRole('button', { name: '交流偏好' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '服務與專長' })
    ).not.toBeInTheDocument();
  });
});
