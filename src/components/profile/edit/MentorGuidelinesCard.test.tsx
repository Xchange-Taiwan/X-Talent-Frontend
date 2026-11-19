import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MentorGuidelinesCard } from './MentorGuidelinesCard';

describe('MentorGuidelinesCard (#961 & #970)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides premature L1~L5 成長計畫 rule by default (#970) and shows all 4 rules when NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2=true', () => {
    const onCheckedChange = vi.fn();
    const { unmount } = render(
      <MentorGuidelinesCard checked={false} onCheckedChange={onCheckedChange} />
    );

    expect(
      screen.queryByTestId('mentor-guidelines-details')
    ).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: '查看規範' });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('真實身分')).toBeInTheDocument();
    expect(screen.getByText('準時出席')).toBeInTheDocument();
    expect(screen.getByText('尊重隱私')).toBeInTheDocument();
    expect(screen.queryByText('成長計畫')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /我已閱讀並同意導師規範/ })
    );
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    unmount();

    vi.stubEnv('NEXT_PUBLIC_ENABLE_DUAL_TRACK_V2', 'true');
    render(
      <MentorGuidelinesCard
        checked={false}
        defaultExpanded
        onCheckedChange={onCheckedChange}
      />
    );
    expect(screen.getByText('成長計畫')).toBeInTheDocument();
  });
});
