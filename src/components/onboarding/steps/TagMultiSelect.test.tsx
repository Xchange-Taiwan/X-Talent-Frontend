import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeEach,describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

import { Form } from '@/components/ui/form';
import { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

import { TagMultiSelect } from './TagMultiSelect';

const testSchema = z.object({
  test_field: z
    .array(z.string())
    .min(1, '請至少選擇一個項目')
    .max(2, '最多選 2 個'),
});

const mockGroups: TagCatalogGroupVO[] = [
  {
    subject_group: 'g1',
    subject: 'Group 1',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 1,
        subject_group: 'tag1',
        subject: 'Tag 1',
        language: 'zh-TW',
      },
      {
        tag_id: 2,
        subject_group: 'tag2',
        subject: 'Tag 2',
        language: 'zh-TW',
      },
      {
        tag_id: 3,
        subject_group: 'tag3',
        subject: 'Tag 3',
        language: 'zh-TW',
      },
    ],
  },
];

const TestComponent = ({ maxSelected = 2 }: { maxSelected?: number }) => {
  const form = useForm<z.infer<typeof testSchema>>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      test_field: [],
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <TagMultiSelect
          control={form.control}
          name="test_field"
          groups={mockGroups}
          maxSelected={maxSelected}
        />
        <button type="submit">提交</button>
      </form>
    </Form>
  );
};

describe('TagMultiSelect', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
  });

  it('renders correctly and toggles selection', async () => {
    render(<TestComponent />);

    // Verify categories and tags render
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
    expect(screen.getByText('Tag 3')).toBeInTheDocument();

    const checkbox1 = screen.getByLabelText('Tag 1');
    expect(checkbox1).toHaveAttribute('aria-checked', 'false');

    // Click Tag 1 to check it
    fireEvent.click(checkbox1);
    expect(checkbox1).toHaveAttribute('aria-checked', 'true');

    // Click Tag 1 again to uncheck it
    fireEvent.click(checkbox1);
    expect(checkbox1).toHaveAttribute('aria-checked', 'false');
  });

  it('respects the maxSelected limit', () => {
    render(<TestComponent maxSelected={2} />);

    const checkbox1 = screen.getByLabelText('Tag 1');
    const checkbox2 = screen.getByLabelText('Tag 2');
    const checkbox3 = screen.getByLabelText('Tag 3');

    // Check Tag 1 and Tag 2
    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);

    expect(checkbox1).toHaveAttribute('aria-checked', 'true');
    expect(checkbox2).toHaveAttribute('aria-checked', 'true');

    // Since maxSelected is 2, Tag 3 should be disabled
    expect(checkbox3).toBeDisabled();

    // Try to click Tag 3 (should not change checked state)
    fireEvent.click(checkbox3);
    expect(checkbox3).toHaveAttribute('aria-checked', 'false');

    // Uncheck Tag 1, Tag 3 should become enabled again
    fireEvent.click(checkbox1);
    expect(checkbox3).not.toBeDisabled();

    // Check Tag 3
    fireEvent.click(checkbox3);
    expect(checkbox3).toHaveAttribute('aria-checked', 'true');
  });

  it('shows error message when validation fails upon submission', async () => {
    render(<TestComponent />);

    const submitBtn = screen.getByRole('button', { name: '提交' });

    // Click submit with empty selection to trigger validation
    fireEvent.click(submitBtn);

    // Verify validation error message is rendered
    expect(await screen.findByText('請至少選擇一個項目')).toBeInTheDocument();
  });
});
