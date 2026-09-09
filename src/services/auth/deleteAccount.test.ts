import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { deleteAccount } from '@/services/auth/deleteAccount';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      delete: vi.fn(),
    },
  };
});

import { apiClient } from '@/lib/apiClient';

describe('deleteAccount service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_CAN_DELETE_ACCOUNT: 'true' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return error when NEXT_PUBLIC_CAN_DELETE_ACCOUNT is not true', async () => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';

    const payload = fromPartial<Parameters<typeof deleteAccount>[0]>({
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await deleteAccount(payload);

    expect(result).toEqual({
      status: 'error',
      message: '此環境不支援帳號刪除',
    });
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('should return success when apiClient.delete resolves successfully', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(fromPartial({}));

    const payload = fromPartial<Parameters<typeof deleteAccount>[0]>({
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await deleteAccount(payload);

    expect(result).toEqual({ status: 'success' });
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/auth/account', payload);
  });

  it('should return blocked_reservations when apiClient.delete throws 409 ApiError', async () => {
    const apiError = new ApiError(409, 'Blocked by unfinished reservations');
    vi.mocked(apiClient.delete).mockRejectedValue(apiError);

    const payload = fromPartial<Parameters<typeof deleteAccount>[0]>({
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await deleteAccount(payload);

    expect(result).toEqual({ status: 'blocked_reservations' });
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/auth/account', payload);
  });

  it('should return general error when apiClient.delete throws other ApiError', async () => {
    const apiError = new ApiError(400, 'Invalid credentials');
    vi.mocked(apiClient.delete).mockRejectedValue(apiError);

    const payload = fromPartial<Parameters<typeof deleteAccount>[0]>({
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await deleteAccount(payload);

    expect(result).toEqual({
      status: 'error',
      message: 'Invalid credentials',
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/auth/account', payload);
  });

  it('should return generic system error when apiClient.delete throws a non-ApiError', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('Network error'));

    const payload = fromPartial<Parameters<typeof deleteAccount>[0]>({
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await deleteAccount(payload);

    expect(result).toEqual({
      status: 'error',
      message: '系統錯誤，請稍後再試',
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/auth/account', payload);
  });
});
