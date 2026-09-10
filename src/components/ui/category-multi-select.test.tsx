import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  type Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';

const CATEGORIES: Category[] = [
  {
    key: 'fruits',
    label: '水果',
    options: [
      { value: 'apple', label: '蘋果' },
      { value: 'banana', label: '香蕉' },
    ],
  },
];

describe('CategoryMultiSelect disabled state', () => {
  it('disables the search input when disabled', () => {
    render(
      <CategoryMultiSelect
        categories={CATEGORIES}
        value={[]}
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByPlaceholderText('Search...')).toBeDisabled();
  });

  it('does not expand a category or call onChange when clicking the category header while disabled', async () => {
    const onChange = vi.fn();
    render(
      <CategoryMultiSelect
        categories={CATEGORIES}
        value={[]}
        onChange={onChange}
        disabled
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /水果/ }));

    expect(screen.queryByText('蘋果')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not toggle a selected option when clicking it while disabled', async () => {
    const onChange = vi.fn();
    render(
      <CategoryMultiSelect
        categories={CATEGORIES}
        flat
        value={['apple']}
        onChange={onChange}
        disabled
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: '蘋果' });
    expect(checkbox).toBeDisabled();

    await userEvent.click(screen.getByText('蘋果'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows expanding categories and toggling options when enabled', async () => {
    const onChange = vi.fn();
    render(
      <CategoryMultiSelect
        categories={CATEGORIES}
        value={[]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /水果/ }));
    await userEvent.click(screen.getByText('蘋果'));

    expect(onChange).toHaveBeenCalledWith(['apple']);
  });
});
