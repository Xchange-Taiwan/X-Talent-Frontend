import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockMentors } from '@/components/mentor-pool/__mocks__/mentors.mock';
import { Toaster } from '@/components/ui/toaster';
import { FAVORITE_MENTOR_ERROR_TOAST_MESSAGE } from '@/hooks/favorites';
import {
  type FavoriteMentorServiceAdapter,
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import FavoritesPageContainer from './container';
import FavoritesPage from './page';

const routerReplaceMock = vi.fn();
const routerPushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

const mockUseTagCatalog = vi.fn();
vi.mock('@/hooks/user/tags/useTagCatalog', () => ({
  default: (...args: unknown[]) => mockUseTagCatalog(...args),
}));

const EMPTY_BUCKET_CATALOG: TagCatalogsByBucket = {
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
  industry: [],
};

function renderWithSession(
  ui: ReactNode,
  options: {
    userId?: string | null;
    status?: 'authenticated' | 'unauthenticated' | 'loading';
  } = {}
) {
  const {
    userId = '9001',
    status = userId ? 'authenticated' : 'unauthenticated',
  } = options;

  const sessionValue =
    status === 'authenticated' && userId
      ? fromPartial<SessionContextValue>({
          data: {
            user: {
              id: userId,
              email: 'mentee@example.com',
              name: 'Mentee Viewer',
              onBoarding: true,
              isMentor: false,
            },
            accessToken: 'mock-token',
            expires: '2099-01-01T00:00:00.000Z',
          },
          status: 'authenticated',
          update: async () => null,
        })
      : fromPartial<SessionContextValue>({
          data: null,
          status: status === 'loading' ? 'loading' : 'unauthenticated',
          update: async () => null,
        });

  return render(
    <SessionContext.Provider value={sessionValue}>
      {ui}
      <Toaster />
    </SessionContext.Provider>
  );
}

describe('FavoritesPageContainer', () => {
  const fetchMock =
    vi.fn<FavoriteMentorServiceAdapter['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorServiceAdapter['addFavoriteMentor']>();
  const removeMock =
    vi.fn<FavoriteMentorServiceAdapter['removeFavoriteMentor']>();

  beforeEach(() => {
    resetFavoriteMentorStore();
    vi.clearAllMocks();

    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });

    mockUseTagCatalog.mockReturnValue({
      ...EMPTY_BUCKET_CATALOG,
      have_topic: [
        {
          subject_group: 'career_group',
          subject: '職涯發展',
          language: 'zh_TW',
          leaves: [
            {
              tag_id: 1,
              subject_group: 'portfolio_review',
              subject: '作品集健檢',
              language: 'zh_TW',
            },
            {
              tag_id: 2,
              subject_group: 'career_planning',
              subject: '職涯規劃',
              language: 'zh_TW',
            },
          ],
        },
      ],
      have_skill: [
        {
          subject_group: 'design_group',
          subject: '設計',
          language: 'zh_TW',
          leaves: [
            {
              tag_id: 3,
              subject_group: 'product_design',
              subject: '產品設計',
              language: 'zh_TW',
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('redirects unauthenticated visitors to /auth/signin?callbackUrl=%2Ffavorites without flashing empty state', async () => {
    renderWithSession(<FavoritesPage />, {
      userId: null,
      status: 'unauthenticated',
    });

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        '/auth/signin?callbackUrl=%2Ffavorites'
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('還沒有收藏的導師')).not.toBeInTheDocument();
  });

  it('holds loading state without redirecting while session is still resolving', () => {
    renderWithSession(<FavoritesPageContainer />, {
      userId: null,
      status: 'loading',
    });

    expect(routerReplaceMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('還沒有收藏的導師')).not.toBeInTheDocument();
  });

  it('translates tag codes via useTagCatalog, removes mentor immediately on unbookmark, and switches to empty state after removing the last mentor', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue([
      {
        ...mockMentors[0],
        user_id: 101,
        name: 'Zahra Mirzakhani',
        have_topic: ['portfolio_review', 'career_planning'],
        have_skill: ['product_design'],
      },
      {
        ...mockMentors[1],
        user_id: 102,
        name: '陳宥廷 Austin',
        have_topic: ['career_planning'],
        have_skill: [],
      },
    ]);

    renderWithSession(<FavoritesPage />);

    expect(await screen.findByText('已收藏 2 位導師')).toBeInTheDocument();
    expect(mockUseTagCatalog).toHaveBeenCalledWith('zh_TW');

    const initialCards = screen.getAllByRole('article');
    expect(initialCards).toHaveLength(2);
    expect(
      within(initialCards[0]).getAllByText('作品集健檢').length
    ).toBeGreaterThan(0);
    expect(
      within(initialCards[0]).getAllByText('產品設計').length
    ).toBeGreaterThan(0);

    // Unbookmark first mentor -> immediately removed and count becomes 1
    await user.click(
      within(initialCards[0]).getByRole('button', {
        name: '取消收藏 Zahra Mirzakhani',
      })
    );

    expect(removeMock).toHaveBeenCalledWith(101);
    expect(screen.getByText('已收藏 1 位導師')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(
      screen.queryByRole('link', {
        name: '前往 Zahra Mirzakhani 的個人頁面',
      })
    ).not.toBeInTheDocument();

    // Unbookmark last mentor -> immediately transitions to empty state
    await user.click(
      screen.getByRole('button', { name: '取消收藏 陳宥廷 Austin' })
    );

    expect(removeMock).toHaveBeenCalledWith(102);
    expect(screen.getByText('已收藏 0 位導師')).toBeInTheDocument();
    expect(screen.getByText('還沒有收藏的導師')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '尋找導師' })).toHaveAttribute(
      'href',
      '/mentor-pool'
    );
  });

  it('renders empty state when favoriteMentors resolves empty (such as backend 404 fallback)', async () => {
    fetchMock.mockResolvedValue([]);

    renderWithSession(<FavoritesPageContainer />);

    expect(await screen.findByText('還沒有收藏的導師')).toBeInTheDocument();
    expect(screen.getByText('已收藏 0 位導師')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '尋找導師' })).toHaveAttribute(
      'href',
      '/mentor-pool'
    );
  });

  it('rolls back mentor card and displays error toast when removeFavoriteMentor fails', async () => {
    const user = userEvent.setup();
    removeMock.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    fetchMock.mockResolvedValue([
      {
        ...mockMentors[0],
        user_id: 101,
        name: 'Zahra Mirzakhani',
        have_topic: ['portfolio_review'],
        have_skill: [],
      },
    ]);

    renderWithSession(<FavoritesPageContainer />);

    expect(await screen.findByText('已收藏 1 位導師')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '取消收藏 Zahra Mirzakhani' })
    );

    expect(
      await screen.findByText(FAVORITE_MENTOR_ERROR_TOAST_MESSAGE)
    ).toBeVisible();
    expect(screen.getByText('已收藏 1 位導師')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});
