import { act, render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AvatarSection } from './AvatarSection';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/components/ui/avatar-upload', () => ({
  default: ({ avatarUrl }: { avatarUrl: string }) => (
    <div data-testid="avatar-upload-url">{avatarUrl}</div>
  ),
}));

interface TestFormValues {
  avatar: string;
  avatarFile?: File;
}

function Harness({
  defaultAvatar = '',
  onReady,
}: {
  defaultAvatar?: string;
  onReady?: (methods: ReturnType<typeof useForm<TestFormValues>>) => void;
}) {
  const methods = useForm<TestFormValues>({
    defaultValues: { avatar: defaultAvatar, avatarFile: undefined },
  });
  React.useEffect(() => {
    onReady?.(methods);
  }, [methods, onReady]);

  return (
    <FormProvider {...methods}>
      <AvatarSection control={methods.control} name="avatarFile" />
    </FormProvider>
  );
}

describe('AvatarSection (#905)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: '42',
          name: 'Test User',
          avatar: 'https://cdn.example.com/session-oauth-avatar.jpg',
        },
        expires: '2099-01-01',
      },
      status: 'authenticated',
      update: vi.fn(),
    });
  });

  it('falls back to session.user.avatar when watched avatar is default empty string and not dirty', () => {
    render(<Harness defaultAvatar="" />);
    expect(screen.getByTestId('avatar-upload-url')).toHaveTextContent(
      'https://cdn.example.com/session-oauth-avatar.jpg'
    );
  });

  it('prefers non-empty form avatar over session.user.avatar once hydrated', () => {
    render(
      <Harness defaultAvatar="https://s3.amazonaws.com/bucket/files/42/avatar?v=123" />
    );
    expect(screen.getByTestId('avatar-upload-url')).toHaveTextContent(
      'https://s3.amazonaws.com/bucket/files/42/avatar?v=123'
    );
  });

  it('reflects explicit user clear (dirty empty string) instead of falling back to stale session avatar', () => {
    let formMethods: ReturnType<typeof useForm<TestFormValues>> | undefined;
    render(
      <Harness
        defaultAvatar="https://s3.amazonaws.com/bucket/files/42/avatar?v=123"
        onReady={(m) => {
          formMethods = m;
        }}
      />
    );

    act(() => {
      formMethods?.setValue('avatar', '', { shouldDirty: true });
    });

    expect(screen.getByTestId('avatar-upload-url')).toHaveTextContent('');
  });
});

function MenteeHarness({
  variant,
  onReady,
}: {
  variant: 'default' | 'compact';
  onReady?: (methods: ReturnType<typeof useForm<TestFormValues>>) => void;
}) {
  const methods = useForm<TestFormValues>({
    defaultValues: { avatar: '', avatarFile: undefined },
  });
  React.useEffect(() => {
    onReady?.(methods);
  }, [methods, onReady]);

  return (
    <FormProvider {...methods}>
      <AvatarSection
        control={methods.control}
        name="avatarFile"
        isMentor={false}
        onSelectPresetAvatar={vi.fn()}
        variant={variant}
        id="avatarFile"
      />
    </FormProvider>
  );
}

describe('AvatarSection Mentee avatar upload failure feedback (#981)', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: '42', name: 'Mentee User', avatar: '' },
        expires: '2099-01-01',
      },
      status: 'authenticated',
      update: vi.fn(),
    });
  });

  it.each(['default', 'compact'] as const)(
    'renders the avatarFile field error inline for Mentees (%s variant)',
    (variant) => {
      let formMethods: ReturnType<typeof useForm<TestFormValues>> | undefined;
      render(
        <MenteeHarness
          variant={variant}
          onReady={(m) => {
            formMethods = m;
          }}
        />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      act(() => {
        formMethods?.setError('avatarFile', {
          type: 'manual',
          message: '頭像上傳失敗，請重新選擇。',
        });
      });

      expect(screen.getByRole('alert')).toHaveTextContent(
        '頭像上傳失敗，請重新選擇。'
      );

      act(() => {
        formMethods?.clearErrors('avatarFile');
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }
  );
});
