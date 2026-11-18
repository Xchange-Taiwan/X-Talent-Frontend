import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExchangeServer = vi.fn();
const mockContainerSpy = vi.fn();

vi.mock('@/lib/auth/bffSession.server', () => ({
  exchangeGoogleOAuthCodeServer: (...args: unknown[]) =>
    mockExchangeServer(...args),
}));

vi.mock('./container', () => ({
  default: (props: unknown) => {
    mockContainerSpy(props);
    return <div data-testid="oauth-redirect-container" />;
  },
  GoogleOAuthRedirectShell: () => <div data-testid="oauth-redirect-shell" />,
}));

import { ServerGoogleOAuthBootstrap } from './page';

describe('Google OAuth callback page server bootstrap (#954)', () => {
  beforeEach(() => {
    mockExchangeServer.mockReset();
    mockContainerSpy.mockReset();
  });

  it('exchanges code and state immediately on the server and passes initialPreExchanged to container', async () => {
    const preExchanged = {
      response: { code: '0', msg: 'ok', data: null },
      refreshBridgeToken: 'sealed_jwe',
    };
    mockExchangeServer.mockResolvedValueOnce(preExchanged);

    const ui = await ServerGoogleOAuthBootstrap({
      searchParams: Promise.resolve({ code: 'code_1', state: 'state_1' }),
    });
    render(ui);

    expect(mockExchangeServer).toHaveBeenCalledWith('code_1', 'state_1');
    expect(screen.getByTestId('oauth-redirect-container')).toBeInTheDocument();
    expect(mockContainerSpy).toHaveBeenCalledWith({
      initialPreExchanged: preExchanged,
    });
  });

  it('skips server BFF exchange when code or state query parameter is missing', async () => {
    const ui = await ServerGoogleOAuthBootstrap({
      searchParams: Promise.resolve({ code: 'only_code' }),
    });
    render(ui);

    expect(mockExchangeServer).not.toHaveBeenCalled();
    expect(mockContainerSpy).toHaveBeenCalledWith({
      initialPreExchanged: null,
    });
  });
});
