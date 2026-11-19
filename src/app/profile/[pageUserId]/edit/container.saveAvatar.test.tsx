import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { profileReadModel } from '@/lib/profile/profileReadModel';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

const pushMock = vi.fn();
const updateSessionMock = vi.fn();
const revalidateMock = vi.fn();
const updateProfileMock = vi.fn();
const fetchUserMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/profile/42/edit',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: {
      user: {
        id: '42',
        name: 'Visitor',
        avatar: 'default_1',
        isMentor: false,
        onBoarding: true,
        personalLinks: [],
      },
      expires: '2099-01-01T00:00:00.000Z',
    },
    update: updateSessionMock,
  }),
}));

vi.mock('@/hooks/user/auth/useProfileAuth', () => ({
  useProfileAuth: () => ({
    isAuthorized: true,
    isResolving: false,
  }),
}));

vi.mock('@/hooks/user/country/useLocations', () => ({
  default: () => ({
    locations: [{ value: 'TWN', text: '台灣' }],
  }),
}));

vi.mock('@/app/profile/[pageUserId]/actions', () => ({
  revalidateProfilePath: (...args: unknown[]) => revalidateMock(...args),
}));

vi.mock('@/services/profile/updateProfile', () => ({
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
}));

vi.mock('@/services/profile/user', () => ({
  fetchUserById: (...args: unknown[]) => fetchUserMock(...args),
}));

vi.mock('@/components/ui/avatar-crop-modal', () => ({
  default: ({
    isOpen,
    onSave,
  }: {
    isOpen: boolean;
    onSave: (blob: Blob) => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() =>
          onSave(new Blob(['cropped-bytes'], { type: 'image/jpeg' }))
        }
      >
        模擬完成裁切
      </button>
    ) : null,
}));

vi.mock('@/services/profile/getAvatarSnapshot', () => ({
  getAvatarSnapshot: vi
    .fn()
    .mockResolvedValue(new Blob(['prev-s3-bytes'], { type: 'image/png' })),
}));

vi.mock('@/services/profile/presignedUrl', () => ({
  fetchPresignedUrl: vi.fn().mockResolvedValue({
    url: 'https://x-career-multimedia.s3.amazonaws.com',
    fields: {
      key: 'dev/files/42/avatar',
      AWSAccessKeyId: 'test',
      'x-amz-security-token': 'test',
      policy: 'test',
      signature: 'test',
    },
  }),
}));

import EditProfileContainer from './container';

const EMPTY_CATALOG: TagCatalogsByBucket = {
  industry: [{ subject_group: 'DESIGN', subject: '設計及創意相關業' }],
  have_topic: [],
  have_skill: [],
  want_position: [
    {
      key: 'marketing',
      subject_group: 'marketing',
      subject: '行銷企劃',
      children: [{ subject_group: 'ad_creative', subject: '廣告創意' }],
    } as never,
  ],
  want_skill: [],
  want_topic: [],
};

const INITIAL_MENTEE_DTO: MentorProfileVO = {
  user_id: 42,
  name: 'Visitor',
  avatar: 'default_1',
  is_mentor: false,
  onboarding: true,
  location: 'TWN',
  years_of_experience: 'THREE_TO_FIVE',
  about: '',
  personal_statement: '',
  job_title: '',
  company: '',
  industry: null,
  seniority_level: null,
  language: 'zh_TW',
  experiences: [],
  want_position: ['ad_creative'],
  want_skill: ['copywriting'],
  want_topic: ['career'],
  have_skill: [],
  have_topic: [],
};

describe('EditProfileContainer real save pipeline regression (#959)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileReadModel.clear();
    profileReadModel.set({ userId: 42, language: 'zh_TW' }, INITIAL_MENTEE_DTO);
    fetchUserMock.mockResolvedValue(INITIAL_MENTEE_DTO);
    updateProfileMock.mockResolvedValue(undefined);
    updateSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(null), 60);
        })
    );
  });

  it('never flashes 載入失敗，請稍後再試。 while revalidateProfilePath is in flight and updates avatar cleanly', async () => {
    let resolveRevalidate!: () => void;
    revalidateMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRevalidate = resolve;
        })
    );

    render(
      <EditProfileContainer pageUserId="42" initialTagCatalog={EMPTY_CATALOG} />
    );

    // Open MenteeAvatarDialog, pick 預設頭像 3, confirm dialog
    const editAvatarBtn = await screen.findByRole('button', {
      name: '編輯頭像',
    });
    fireEvent.click(editAvatarBtn);

    const preset3Btn = await screen.findByRole('button', {
      name: '預設頭像 3',
    });
    fireEvent.click(preset3Btn);
    fireEvent.click(screen.getByRole('button', { name: '儲存頭像' }));

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledTimes(1);
    });

    // CRITICAL REGRESSION CHECK: While revalidateProfilePath is STILL pending,
    // the page must NEVER flash "載入失敗，請稍後再試。"!
    expect(
      screen.queryByText('載入失敗，請稍後再試。')
    ).not.toBeInTheDocument();
    expect(
      profileReadModel.peek({ userId: 42, language: 'zh_TW' })?.avatar
    ).toBe('default_3');

    resolveRevalidate();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/profile/42');
    });
    expect(
      screen.queryByText('載入失敗，請稍後再試。')
    ).not.toBeInTheDocument();
  });

  it('uploads custom cropped photo to S3, rolls back S3 on switching back to initial preset avatar (default_1), prompts on unsaved leave, and still writes PUT /profile', async () => {
    revalidateMock.mockResolvedValue(undefined);
    const s3AvatarDto: MentorProfileVO = {
      ...INITIAL_MENTEE_DTO,
      avatar:
        'https://x-career-multimedia.s3.amazonaws.com/dev/files/42/avatar?v=100',
    };
    profileReadModel.set({ userId: 42, language: 'zh_TW' }, s3AvatarDto);
    fetchUserMock.mockResolvedValue(s3AvatarDto);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(null, { status: 204 }));

    try {
      render(
        <EditProfileContainer
          pageUserId="42"
          initialTagCatalog={EMPTY_CATALOG}
        />
      );

      // 1. Upload a custom image -> crop -> confirm dialog -> kicks off S3 POST upload
      fireEvent.click(await screen.findByRole('button', { name: '編輯頭像' }));
      const fileInput = screen.getByLabelText('選擇個人照片');
      fireEvent.change(fileInput, {
        target: {
          files: [new File(['raw'], 'raw.png', { type: 'image/png' })],
        },
      });

      fireEvent.click(
        await screen.findByRole('button', { name: '模擬完成裁切' })
      );
      fireEvent.click(await screen.findByRole('button', { name: '儲存頭像' }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      // 2. Reopen dialog and switch to 預設頭像 1 -> triggers S3 rollback re-upload of old bytes!
      fireEvent.click(await screen.findByRole('button', { name: '編輯頭像' }));
      fireEvent.click(
        await screen.findByRole('button', { name: '預設頭像 1' })
      );
      fireEvent.click(screen.getByRole('button', { name: '儲存頭像' }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });

      // 3. Verify reactive hasUnsavedChanges opens prompt when clicking 取消
      fireEvent.click(screen.getByRole('button', { name: '取消' }));
      expect(await screen.findByText('尚未儲存的變更')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }));

      // 4. Submit form -> commits avatar: 'default_1' cleanly!
      fireEvent.click(screen.getByRole('button', { name: '儲存變更' }));

      await waitFor(() => {
        expect(updateProfileMock).toHaveBeenCalledTimes(1);
      });
      expect(updateProfileMock.mock.calls[0]?.[1]).toMatchObject({
        avatar: 'default_1',
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
