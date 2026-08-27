import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { ReplyMessageField } from './ReplyMessageField';

const PLACEHOLDER = '例如：屆時於 Google Meet 見,請先準備一份履歷。';

describe('ReplyMessageField', () => {
  it('renders only the toggle button when closed, and opens on click', () => {
    const onOpen = vi.fn();
    render(
      <ReplyMessageField
        open={false}
        onOpen={onOpen}
        textareaProps={{ value: '', onChange: vi.fn() }}
      />
    );

    expect(
      screen.getByRole('button', { name: '附上回覆訊息（選填）' })
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();

    screen.getByRole('button', { name: '附上回覆訊息（選填）' }).click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders the field label and error message when open', () => {
    render(
      <ReplyMessageField
        open
        onOpen={vi.fn()}
        error="回覆內容過長"
        textareaProps={{ value: '', onChange: vi.fn() }}
      />
    );

    expect(screen.getByText('給學員的回覆（選填）')).toBeInTheDocument();
    expect(screen.getByText('回覆內容過長')).toBeInTheDocument();
  });

  it('works as a plain controlled input (useState-style binding)', async () => {
    function ControlledHarness() {
      const [value, setValue] = React.useState('');
      return (
        <ReplyMessageField
          open
          onOpen={vi.fn()}
          textareaProps={{
            value,
            onChange: (e) => setValue(e.target.value),
          }}
        />
      );
    }

    render(<ControlledHarness />);
    const textarea = screen.getByPlaceholderText(PLACEHOLDER);

    const user = userEvent.setup();
    await user.type(textarea, 'Hi there');

    expect(textarea).toHaveValue('Hi there');
  });

  it('works with react-hook-form register binding', async () => {
    function RhfHarness() {
      const { register, watch } = useForm({ defaultValues: { reply: '' } });
      return (
        <>
          <ReplyMessageField
            open
            onOpen={vi.fn()}
            textareaProps={register('reply')}
          />
          <output>{watch('reply')}</output>
        </>
      );
    }

    render(<RhfHarness />);
    const textarea = screen.getByPlaceholderText(PLACEHOLDER);

    const user = userEvent.setup();
    await user.type(textarea, 'RHF reply');

    expect(textarea).toHaveValue('RHF reply');
    expect(screen.getByText('RHF reply')).toBeInTheDocument();
  });

  it('disables the textarea when the disabled prop is true', () => {
    render(
      <ReplyMessageField
        open
        onOpen={vi.fn()}
        disabled
        textareaProps={{ value: '', onChange: vi.fn() }}
      />
    );

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDisabled();
  });

  it('also disables the textarea when textareaProps itself carries disabled: true, regardless of prop spread order', () => {
    render(
      <ReplyMessageField
        open
        onOpen={vi.fn()}
        textareaProps={{ value: '', onChange: vi.fn(), disabled: true }}
      />
    );

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDisabled();
  });
});
