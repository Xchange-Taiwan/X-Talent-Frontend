import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('Announcement API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  it('returns mock fallback data when process.env.EDGE_CONFIG is not defined', async () => {
    delete process.env.EDGE_CONFIG;
    process.env.MOCK_ANNOUNCEMENT_ENABLED = 'true';
    process.env.MOCK_ANNOUNCEMENT_MESSAGE = '測試公告訊息';
    process.env.MOCK_ANNOUNCEMENT_TIME = '2026-08-10T00:00:00Z';

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '測試公告訊息',
      maintenanceTime: '2026-08-10T00:00:00Z',
    });
  });

  it('fetches and returns configuration from Edge Config when process.env.EDGE_CONFIG is defined', async () => {
    process.env.EDGE_CONFIG =
      'https://edge-config.vercel.com/ecfg_test?token=test';

    const edgeConfigMockData = {
      announcement: {
        enabled: true,
        message: '來自 Edge Config 的公告',
        maintenanceTime: '2026-08-12T12:00:00Z',
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(edgeConfigMockData)),
      json: () => Promise.resolve(edgeConfigMockData),
    });
    global.fetch = fetchMock;

    const response = await GET();
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://edge-config.vercel.com/ecfg_test?token=test',
      expect.objectContaining({
        method: 'GET',
        next: { revalidate: 0 },
      })
    );

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '來自 Edge Config 的公告',
      maintenanceTime: '2026-08-12T12:00:00Z',
    });
  });

  it('falls back to mock data when Edge Config fetch fails', async () => {
    process.env.EDGE_CONFIG =
      'https://edge-config.vercel.com/ecfg_test?token=test';
    process.env.MOCK_ANNOUNCEMENT_ENABLED = 'true';
    process.env.MOCK_ANNOUNCEMENT_MESSAGE = '連線失敗的備份公告';
    process.env.MOCK_ANNOUNCEMENT_TIME = '2026-08-10T00:00:00Z';

    const fetchMock = vi.fn().mockRejectedValue(new Error('Fetch failed'));
    global.fetch = fetchMock;

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual({
      enabled: true,
      message: '連線失敗的備份公告',
      maintenanceTime: '2026-08-10T00:00:00Z',
    });
  });
});
