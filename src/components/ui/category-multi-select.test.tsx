import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type Category, CategoryMultiSelect } from './category-multi-select';

const mockCategories: Category[] = [
  {
    key: 'tech',
    label: '科技資訊',
    options: [
      { value: 'frontend', label: '前端開發' },
      { value: 'backend', label: '後端開發' },
    ],
  },
  {
    key: 'design',
    label: '視覺設計',
    options: [
      { value: 'uiux', label: 'UI/UX 設計' },
      { value: 'graphic', label: '平面設計' },
    ],
  },
];

describe('CategoryMultiSelect', () => {
  it('renders search input and category labels correctly', () => {
    render(
      <CategoryMultiSelect
        categories={mockCategories}
        value={[]}
        onChange={() => {}}
      />
    );

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(screen.getByText('科技資訊')).toBeInTheDocument();
    expect(screen.getByText('視覺設計')).toBeInTheDocument();
  });

  it('filters list items when typing in search input', () => {
    render(
      <CategoryMultiSelect
        categories={mockCategories}
        value={[]}
        onChange={() => {}}
      />
    );

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: '前端' } });

    expect(screen.getByText('前端開發')).toBeInTheDocument();
    expect(screen.queryByText('UI/UX 設計')).not.toBeInTheDocument();
  });

  it('respects flat layout rendering flat without collapsing headers', () => {
    render(
      <CategoryMultiSelect
        categories={mockCategories}
        flat={true}
        value={[]}
        onChange={() => {}}
      />
    );

    expect(screen.queryByText('科技資訊')).not.toBeInTheDocument();
    expect(screen.getByText('前端開發')).toBeInTheDocument();
    expect(screen.getByText('平面設計')).toBeInTheDocument();
  });

  it('selects and deselects options correctly on click', () => {
    const handleChange = vi.fn();

    render(
      <CategoryMultiSelect
        categories={mockCategories}
        flat={true}
        value={['frontend']}
        onChange={handleChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: '平面設計' });
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith(['frontend', 'graphic']);

    const selectedCheckbox = screen.getByRole('checkbox', { name: '前端開發' });
    fireEvent.click(selectedCheckbox);
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('enforces maximum selection limit correctly', () => {
    const handleChange = vi.fn();

    render(
      <CategoryMultiSelect
        categories={mockCategories}
        flat={true}
        value={['frontend', 'backend']}
        maxSelected={2}
        onChange={handleChange}
      />
    );

    // Flat list of UI/UX design should be disabled since max selection of 2 is reached
    const checkbox = screen.getByRole('checkbox', { name: 'UI/UX 設計' });
    expect(checkbox).toBeDisabled();

    fireEvent.click(checkbox);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
