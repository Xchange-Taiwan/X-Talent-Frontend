import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MentorGuidelinesCard } from './MentorGuidelinesCard';

describe('MentorGuidelinesCard (#961)', () => {
  it('defaults to collapsed state, expands 4 guidelines on 查看規範 click, and toggles checkbox', () => {
    const onCheckedChange = vi.fn();
    render(
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
    expect(screen.getByText('成長計畫')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /我已閱讀並同意導師規範/ })
    );
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
