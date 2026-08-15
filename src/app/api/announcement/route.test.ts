import { get } from '@vercel/global-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/global-config', () => ({
  get: vi.fn(),
}));

import { GET } from './route';

const mockGet = vi.mocked(get);

describe('Announcement API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns mock fallback data when no Global/Edge Config env var is defined', async () => {
    delete process.env.GLOBAL_CONFIG;
    delete process.env.EDGE_CONFIG;
    process.env.MOCK_ANNOUNCEMENT_ENABLED = 'true';
    process.env.MOCK_ANNOUNCEMENT_MESSAGE = '測試公告訊息';
    process.env.MOCK_ANNOUNCEMENT_TIME = '2026-08-10T00:00:00Z';

    const response = await GET();
    expect(response.status).toBe(200);
    expect(mockGet).not.toHaveBeenCalled();

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '測試公告訊息',
      maintenanceTime: '2026-08-10T00:00:00Z',
    });
  });

  it('reads the announcement item via the SDK when GLOBAL_CONFIG is defined', async () => {
    process.env.GLOBAL_CONFIG = 'connection_string';
    mockGet.mockResolvedValue({
      enabled: true,
      message: '來自 Global Config 的公告',
      maintenanceTime: '2026-08-12T12:00:00Z',
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith('announcement');

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '來自 Global Config 的公告',
      maintenanceTime: '2026-08-12T12:00:00Z',
    });
  });

  it('still reads via the SDK when only the legacy EDGE_CONFIG env var is set', async () => {
    delete process.env.GLOBAL_CONFIG;
    process.env.EDGE_CONFIG = 'connection_string';
    mockGet.mockResolvedValue({
      enabled: true,
      message: '來自 Edge Config 的公告',
      maintenanceTime: '2026-08-12T12:00:00Z',
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith('announcement');

    const json = await response.json();
    expect(json.message).toBe('來自 Edge Config 的公告');
  });

  it('falls back to mock data when the SDK read throws', async () => {
    process.env.GLOBAL_CONFIG = 'connection_string';
    process.env.MOCK_ANNOUNCEMENT_ENABLED = 'true';
    process.env.MOCK_ANNOUNCEMENT_MESSAGE = '連線失敗的備份公告';
    process.env.MOCK_ANNOUNCEMENT_TIME = '2026-08-10T00:00:00Z';

    mockGet.mockRejectedValue(new Error('Fetch failed'));

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '連線失敗的備份公告',
      maintenanceTime: '2026-08-10T00:00:00Z',
    });
  });

  it('falls back to mock data when the SDK returns no value for the key', async () => {
    process.env.GLOBAL_CONFIG = 'connection_string';
    process.env.MOCK_ANNOUNCEMENT_ENABLED = 'true';
    process.env.MOCK_ANNOUNCEMENT_MESSAGE = '沒有設定公告時的備份';
    process.env.MOCK_ANNOUNCEMENT_TIME = '';

    mockGet.mockResolvedValue(undefined);

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '沒有設定公告時的備份',
      maintenanceTime: '',
    });
  });
});
