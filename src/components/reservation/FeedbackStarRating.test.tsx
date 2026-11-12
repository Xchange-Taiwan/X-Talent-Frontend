import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FeedbackStarRating } from './FeedbackStarRating';

describe('FeedbackStarRating', () => {
  it('renders 10 accessible radio star buttons with filled state up to value', () => {
    render(<FeedbackStarRating value={8} onChange={() => {}} />);

    const group = screen.getByRole('radiogroup', { name: '整體滿意度' });
    expect(group).toBeInTheDocument();

    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(10);
    expect(screen.getByRole('radio', { name: '8 分' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('radio', { name: '8 分' })).toHaveAttribute(
      'data-filled',
      'true'
    );
    expect(screen.getByRole('radio', { name: '9 分' })).toHaveAttribute(
      'data-filled',
      'false'
    );
  });

  it('supports click selection, hover preview, and keyboard Arrow/Home/End navigation', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FeedbackStarRating value={10} onChange={onChange} />
    );

    // Hover preview highlights up to hovered star and restores on mouseleave
    fireEvent.mouseEnter(screen.getByRole('radio', { name: '6 分' }));
    expect(screen.getByRole('radio', { name: '6 分' })).toHaveAttribute(
      'data-filled',
      'true'
    );
    expect(screen.getByRole('radio', { name: '7 分' })).toHaveAttribute(
      'data-filled',
      'false'
    );
    fireEvent.mouseLeave(screen.getByRole('radio', { name: '6 分' }));
    expect(screen.getByRole('radio', { name: '10 分' })).toHaveAttribute(
      'data-filled',
      'true'
    );

    // Click star 7
    fireEvent.click(screen.getByRole('radio', { name: '7 分' }));
    expect(onChange).toHaveBeenCalledWith(7);

    rerender(<FeedbackStarRating value={7} onChange={onChange} />);

    // Keyboard navigation
    const star7 = screen.getByRole('radio', { name: '7 分' });
    fireEvent.keyDown(star7, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(6);

    fireEvent.keyDown(star7, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(8);

    fireEvent.keyDown(star7, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(1);

    fireEvent.keyDown(star7, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(10);
  });
});
