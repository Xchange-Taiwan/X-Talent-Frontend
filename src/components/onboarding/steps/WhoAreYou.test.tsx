import { render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useSession } from 'next-auth/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

import { step1Schema } from './index';
import { WhoAreYou } from './WhoAreYou';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

const avatarUploadMock = vi.hoisted(() => ({
  lastAvatarUrl: undefined as string | undefined,
}));

vi.mock('@/components/ui/avatar-upload', () => ({
  default: ({ avatarUrl }: { avatarUrl?: string }) => {
    avatarUploadMock.lastAvatarUrl = avatarUrl;
    return <div data-testid="mock-avatar-upload" data-avatar-url={avatarUrl} />;
  },
}));

const mockUseSession = vi.mocked(useSession);

function TestWhoAreYouHarness({
  defaultAvatar = '',
  defaultName = '測試使用者',
}: {
  defaultAvatar?: string;
  defaultName?: string;
}) {
  const form = useForm<z.infer<typeof step1Schema>>({
    defaultValues: {
      name: defaultName,
      avatar: defaultAvatar,
      avatarFile: undefined,
      language: 'zh_TW',
    },
  });

  return (
    <Form {...form}>
      <WhoAreYou form={form} />
    </Form>
  );
}

describe('WhoAreYou avatarDisplayUrl query param handling (#857)', () => {
  beforeEach(() => {
    avatarUploadMock.lastAvatarUrl = undefined;
    mockUseSession.mockReset();
  });

  it('passes empty avatarUrl when watchedAvatar is empty', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: null,
        status: 'unauthenticated',
      })
    );

    render(<TestWhoAreYouHarness defaultAvatar="" />);

    expect(avatarUploadMock.lastAvatarUrl).toBe('');
  });

  it('appends ?cb= when watchedAvatar has no existing query parameters (e.g. Google OAuth =s512-c URL)', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: {
          user: {
            avatarUpdatedAt: 1700000123,
          },
        },
        status: 'authenticated',
      })
    );

    const googleAvatarUrl =
      'https://lh3.googleusercontent.com/a/ACg8ocTest=s512-c';
    render(<TestWhoAreYouHarness defaultAvatar={googleAvatarUrl} />);

    expect(avatarUploadMock.lastAvatarUrl).toBe(
      `${googleAvatarUrl}?cb=1700000123`
    );
    expect(screen.getByTestId('mock-avatar-upload')).toHaveAttribute(
      'data-avatar-url',
      `${googleAvatarUrl}?cb=1700000123`
    );
  });

  it('appends &cb= instead of a duplicate ?cb= when watchedAvatar already contains query parameters', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: {
          user: {
            avatarUpdatedAt: 1700000456,
          },
        },
        status: 'authenticated',
      })
    );

    const versionedAvatarUrl =
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/cropped-avatar.png?v=1700000000';
    render(<TestWhoAreYouHarness defaultAvatar={versionedAvatarUrl} />);

    expect(avatarUploadMock.lastAvatarUrl).toBe(
      `${versionedAvatarUrl}&cb=1700000456`
    );
    expect(avatarUploadMock.lastAvatarUrl?.split('?')).toHaveLength(2);
  });
});
