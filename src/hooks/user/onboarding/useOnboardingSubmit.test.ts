import { act, renderHook } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildOnboardingDtoStub } from '@/hooks/user/onboarding/buildOnboardingDtoStub';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { captureFlowFailure } from '@/lib/monitoring';
import { updateProfile } from '@/services/profile/updateProfile';

import { useOnboardingSubmit } from './useOnboardingSubmit';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/hooks/user/onboarding/buildOnboardingDtoStub', () => ({
  buildOnboardingDtoStub: vi.fn(),
}));

vi.mock('@/hooks/user/user-data/useUserData', () => ({
  clearUserDataCache: vi.fn(),
  primeUserDataCache: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/services/profile/updateProfile', () => ({
  updateProfile: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockBuildOnboardingDtoStub = vi.mocked(buildOnboardingDtoStub);
const mockClearUserDataCache = vi.mocked(clearUserDataCache);
const mockPrimeUserDataCache = vi.mocked(primeUserDataCache);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockUpdateProfile = vi.mocked(updateProfile);

describe('useOnboardingSubmit', () => {
  const mockUpdateSession = vi.fn();
  const mockSession = {
    user: {
      id: '123',
      name: 'Old Name',
      avatar: 'old-avatar.png',
    },
  };

  const mockIndustries = [
    {
      id: 1,
      subject_group: 'TECH',
      subject: '科技業',
      category: 'INDUSTRY',
      language: 'zh_TW',
    },
  ] as any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: mockUpdateSession,
    } as any);
  });

  it('should successfully submit profile, prime cache, and optimistically update session', async () => {
    const formData = {
      name: 'New Name',
      avatar: 'new-avatar.png',
      location: 'TWN',
      years_of_experience: '1_3',
      language: 'zh_TW',
      want_position: ['position1'],
      want_skill: ['skill1'],
      want_topic: ['topic1'],
    };

    mockUpdateProfile.mockResolvedValue({} as any);
    const mockStub = { user_id: 123 } as any;
    mockBuildOnboardingDtoStub.mockReturnValue(mockStub);

    const { result } = renderHook(() =>
      useOnboardingSubmit({ industries: mockIndustries })
    );

    await act(async () => {
      await result.current.submitProfile(formData, true);
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(formData);
    expect(mockBuildOnboardingDtoStub).toHaveBeenCalledWith({
      userId: 123,
      formData,
      industryCatalog: mockIndustries,
    });
    expect(mockPrimeUserDataCache).toHaveBeenCalledWith(123, 'zh_TW', mockStub);
    expect(mockUpdateSession).toHaveBeenCalledWith({
      user: {
        id: '123',
        name: 'New Name',
        avatar: 'new-avatar.png',
        onBoarding: true,
        avatarUpdatedAt: expect.any(Number),
      },
    });
  });

  it('should fallback to clearUserDataCache if session userId is invalid', async () => {
    const formData = {
      name: 'New Name',
      avatar: 'new-avatar.png',
      location: 'TWN',
      years_of_experience: '1_3',
      language: 'zh_TW',
      want_position: ['position1'],
      want_skill: ['skill1'],
      want_topic: ['topic1'],
    };

    mockUseSession.mockReturnValue({
      data: { user: { id: 'invalid-non-numeric' } },
      status: 'authenticated',
      update: mockUpdateSession,
    } as any);

    mockUpdateProfile.mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useOnboardingSubmit({ industries: mockIndustries })
    );

    await act(async () => {
      await result.current.submitProfile(formData, false);
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(formData);
    expect(mockPrimeUserDataCache).not.toHaveBeenCalled();
    expect(mockClearUserDataCache).toHaveBeenCalledWith(NaN, 'zh_TW');
  });

  it('should capture failure and rethrow error when API fails', async () => {
    const formData = {
      name: 'New Name',
      avatar: 'new-avatar.png',
      location: 'TWN',
      years_of_experience: '1_3',
      language: 'zh_TW',
      want_position: ['position1'],
      want_skill: ['skill1'],
      want_topic: ['topic1'],
    };

    const mockError = new Error('API Error');
    mockUpdateProfile.mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useOnboardingSubmit({ industries: mockIndustries })
    );

    await act(async () => {
      await expect(
        result.current.submitProfile(formData, false)
      ).rejects.toThrow('API Error');
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(formData);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'onboarding_submit',
      step: 'submit_profile',
      message: 'API Error',
    });
    expect(mockPrimeUserDataCache).not.toHaveBeenCalled();
  });
});
