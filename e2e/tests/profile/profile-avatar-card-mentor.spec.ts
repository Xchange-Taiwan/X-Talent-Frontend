import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { setSignedSessionCookie } from '../../helpers/session';

// Use a synthetic user ID that does not exist on the dev backend so SSR
// fetchUserByIdServer(/profile/card) returns null and falls back to the
// browser-level mockApiRoute handler.
const USER_ID = '999999';
const S3_BUCKET_URL =
  'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com';
const S3_OBJECT_KEY = `avatars/${USER_ID}/cropped-avatar.png`;

// Valid 1x1 opaque blue PNG (68 bytes) so FileReader + HTMLImageElement.onload
// inside react-avatar-editor succeeds and paints non-transparent pixels.
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
  'base64'
);

function makeSession(isMentor: boolean, avatar = '') {
  return {
    user: {
      id: USER_ID,
      name: 'Test Mentee',
      avatar,
      isMentor,
      onBoarding: true,
      jobTitle: 'Frontend Engineer',
      company: 'XChange',
      personalLinks: [],
    },
    accessToken: 'mock-token',
    expires: '2099-01-01T00:00:00.000Z',
  };
}

interface MakeProfileOptions {
  name?: string;
  isMentor?: boolean;
  avatar?: string;
  about?: string;
  includeMentorFields?: boolean;
}

function makeProfile({
  name = 'Test Mentee',
  isMentor = false,
  avatar = '',
  about = '',
  includeMentorFields = false,
}: MakeProfileOptions = {}) {
  const withMentorData = isMentor || includeMentorFields;
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(USER_ID),
      name,
      avatar,
      onboarding: true,
      is_mentor: isMentor,
      job_title: 'Frontend Engineer',
      company: 'XChange',
      years_of_experience: 'ONE_TO_THREE_YEARS',
      location: 'TWN',
      personal_statement: '熱愛前端開發與職涯交流',
      about,
      language: 'zh_TW',
      industry: {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
      want_position: ['TEST_POS'],
      want_skill: ['TEST_SKILL'],
      want_topic: ['TEST_TOPIC'],
      have_skill: withMentorData ? ['TEST_SKILL'] : [],
      have_topic: withMentorData ? ['TEST_TOPIC'] : [],
      expertises: {
        professions: withMentorData
          ? [
              {
                id: 1,
                subject_group: 'DATA',
                subject: '資料分析',
                category: 'EXPERTISE',
                language: 'zh_TW',
                profession_metadata: { desc: '', icon: '' },
              },
            ]
          : [],
        language: 'zh_TW',
      },
      experiences: withMentorData
        ? [
            {
              id: 1,
              category: 'WORK',
              order: 1,
              mentor_experiences_metadata: {
                data: [
                  {
                    job: 'Frontend Engineer',
                    company: 'XChange',
                    job_period_start: '2021',
                    job_period_end: '2024',
                    industry: 'TECH',
                    job_location: 'TWN',
                    description: '負責設計系統與前端架構',
                  },
                ],
              },
            },
            {
              id: 2,
              category: 'EDUCATION',
              order: 2,
              mentor_experiences_metadata: {
                data: [
                  {
                    school: '國立臺灣大學',
                    subject: '資訊工程學系',
                    education_period_start: '2017',
                    education_period_end: '2021',
                  },
                ],
              },
            },
          ]
        : [],
    },
  };
}

const MOCK_COUNTRIES = { code: '0', msg: 'ok', data: { TWN: '台灣' } };

const MOCK_INDUSTRIES = {
  code: '0',
  msg: 'ok',
  data: {
    professions: [
      {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
    ],
  },
};

const MOCK_EXPERTISES = {
  code: '0',
  msg: 'ok',
  data: {
    professions: [
      {
        id: 1,
        subject_group: 'DATA',
        subject: '資料分析',
        category: 'EXPERTISE',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
    ],
  },
};

function makeInterest(subject: string) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      interests: [
        {
          id: 1,
          subject_group: 'TEST_GROUP',
          subject,
          category: 'TEST',
          language: 'zh_TW',
          desc: { icon: '', desc: '' },
        },
      ],
      language: 'zh_TW',
    },
  };
}

async function mockSessionEndpoints(
  page: Page,
  initialSession: ReturnType<typeof makeSession>
): Promise<void> {
  let currentSession = initialSession;
  await page.route(/\/api\/auth\/session/, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentSession),
      });
    }
    if (method === 'POST' || method === 'PUT') {
      const body = route.request().postDataJSON() as
        { user?: Record<string, unknown> } | undefined;
      if (body?.user) {
        currentSession = {
          ...currentSession,
          user: {
            ...currentSession.user,
            ...body.user,
          } as typeof currentSession.user,
        };
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentSession),
      });
    }
    return route.continue();
  });
}

async function mockDropdowns(page: Page): Promise<void> {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/countries/, {
    body: MOCK_COUNTRIES,
  });
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/industries/, {
    body: MOCK_INDUSTRIES,
  });
  await mockApiRoute(page, /\/v1\/mentors\/zh_TW\/expertises/, {
    body: MOCK_EXPERTISES,
  });
  await page.route(/\/v1\/users\/zh_TW\/interests/, (route) => {
    const url = route.request().url();
    if (url.includes('INTERESTED_POSITION')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterest('測試職位')),
      });
    }
    if (url.includes('SKILL')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterest('測試技能')),
      });
    }
    if (url.includes('TOPIC')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInterest('測試主題')),
      });
    }
    return route.continue();
  });
}

test.describe('Profile Avatar Upload, Card Page & Become Mentor E2E (#790)', () => {
  test('選擇圖片開啟剪裁彈窗 → 儲存後觸發 S3 Presigned POST 並將新頭像網址送入 PUT /profile', async ({
    page,
  }) => {
    const session = makeSession(false);
    await setSignedSessionCookie(page, {
      ...session.user,
      token: 'mock-access-token',
    });
    await mockSessionEndpoints(page, session);
    await mockDropdowns(page);

    let presignedRequested = false;
    let s3PostCalled = false;
    let savedAvatarUrl = '';

    await page.route(
      new RegExp(`/v1/storage/presigned-url/${USER_ID}`),
      (route) => {
        presignedRequested = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '0',
            msg: 'ok',
            data: {
              url: S3_BUCKET_URL,
              fields: {
                key: S3_OBJECT_KEY,
                AWSAccessKeyId: 'mock-access-key',
                'x-amz-security-token': 'mock-security-token',
                policy: 'mock-policy',
                signature: 'mock-signature',
              },
            },
          }),
        });
      }
    );

    await page.route(
      /x-career-multimedia\.s3\.ap-northeast-1\.amazonaws\.com/,
      (route) => {
        if (route.request().method() === 'POST') {
          s3PostCalled = true;
          return route.fulfill({ status: 204, body: '' });
        }
        return route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: TINY_PNG_BUFFER,
        });
      }
    );

    await page.route(
      new RegExp(`/v1/mentors/${USER_ID}/zh_TW/profile`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeProfile({
              avatar: savedAvatarUrl,
            })
          ),
        })
    );

    await page.route(new RegExp(`/v1/mentors/${USER_ID}/profile$`), (route) => {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON() as { avatar?: string };
        savedAvatarUrl = payload.avatar ?? '';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
        });
      }
      return route.fallback();
    });

    await page.goto(`/profile/${USER_ID}/edit`);

    await expect(page.locator('input[name="name"]')).toHaveValue(
      'Test Mentee',
      { timeout: 15_000 }
    );
    expect(presignedRequested).toBe(true);

    // Upload image via hidden file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });

    // Verify AvatarCropModal opens
    const cropDialog = page.getByRole('dialog', { name: '剪裁大頭貼' });
    await expect(cropDialog).toBeVisible();

    // Wait until react-avatar-editor finishes loading and painting the image
    // onto the center of the canvas before clicking 儲存.
    const canvas = cropDialog.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => {
        return canvas.evaluate((el: HTMLCanvasElement) => {
          const ctx = el.getContext('2d');
          if (!ctx) return 0;
          const pixel = ctx.getImageData(
            Math.floor(el.width / 2),
            Math.floor(el.height / 2),
            1,
            1
          ).data;
          return pixel[3];
        });
      })
      .toBeGreaterThan(0);

    await cropDialog.getByRole('button', { name: '儲存' }).click();
    await expect(cropDialog).toBeHidden();

    // Background upload should immediately POST to the presigned S3 URL
    await expect.poll(() => s3PostCalled).toBe(true);

    // Submit the profile form and verify PUT /profile receives the uploaded S3 URL
    await page.getByRole('button', { name: '儲存' }).click();

    await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 30_000 });
    expect(savedAvatarUrl).toMatch(
      new RegExp(`^${S3_BUCKET_URL}/${S3_OBJECT_KEY}\\?v=\\d+$`)
    );
  });

  test('Mentee 造訪 /profile/card → 顯示完成個人頁面訊息與「成為 Mentor」、「開始探索 X-Talent」導向', async ({
    page,
  }) => {
    const session = makeSession(false);
    await setSignedSessionCookie(page, {
      ...session.user,
      token: 'mock-access-token',
    });
    await mockSessionEndpoints(page, session);
    await mockDropdowns(page);

    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${USER_ID}/zh_TW/profile`),
      {
        body: makeProfile({ isMentor: false }),
      }
    );

    await page.goto('/profile/card');

    await expect(page.getByText('恭喜你完成個人頁面的建立！')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Test Mentee' })
    ).toBeVisible();

    const becomeMentorBtn = page.getByRole('button', { name: '成為 Mentor' });
    const exploreBtn = page.getByRole('button', { name: '開始探索 X-Talent' });
    await expect(becomeMentorBtn).toBeVisible();
    await expect(exploreBtn).toBeVisible();

    // Click 成為 Mentor → navigates to /profile/:id/edit?mentor-onboarding=true
    await becomeMentorBtn.click();
    await expect(page).toHaveURL(
      `/profile/${USER_ID}/edit?mentor-onboarding=true`,
      { timeout: 15_000 }
    );

    // Navigate back to /profile/card and verify 開始探索 X-Talent → /mentor-pool
    await page.goto('/profile/card');
    await expect(
      page.getByRole('button', { name: '開始探索 X-Talent' })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '開始探索 X-Talent' }).click();
    await expect(page).toHaveURL('/mentor-pool', { timeout: 15_000 });
  });

  test('Mentor 造訪 /profile/card → 顯示恭喜成為導師訊息，點擊「返回我的個人頁面」導向 /profile/:id', async ({
    page,
  }) => {
    const session = makeSession(true);
    await setSignedSessionCookie(page, {
      ...session.user,
      token: 'mock-access-token',
    });
    await mockSessionEndpoints(page, session);

    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${USER_ID}/zh_TW/profile`),
      {
        body: makeProfile({
          name: 'Test Mentor',
          isMentor: true,
          about: '資深前端導師',
        }),
      }
    );

    await page.goto('/profile/card');

    await expect(page.getByText('恭喜！', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Test Mentor' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '成為 Mentor' })
    ).not.toBeVisible();

    const backToProfileBtn = page.getByRole('button', {
      name: '返回我的個人頁面',
    });
    await expect(backToProfileBtn).toBeVisible();
    await backToProfileBtn.click();

    await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 15_000 });
  });

  test('Mentee 進入 ?mentor-onboarding=true → 顯示 Mentor 必填驗證，補齊欄位儲存後以 is_mentor=true 送出並導向 /profile/card', async ({
    page,
  }) => {
    const avatarUrl = `${S3_BUCKET_URL}/${S3_OBJECT_KEY}`;
    const session = makeSession(false, avatarUrl);
    await setSignedSessionCookie(page, {
      ...session.user,
      token: 'mock-access-token',
    });
    await mockSessionEndpoints(page, session);
    await mockDropdowns(page);

    await page.route(
      /x-career-multimedia\.s3\.ap-northeast-1\.amazonaws\.com/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: TINY_PNG_BUFFER,
        })
    );

    let upgradedToMentor = false;
    let submittedPayload: Record<string, unknown> | null = null;

    await page.route(
      new RegExp(`/v1/mentors/${USER_ID}/zh_TW/profile`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeProfile({
              isMentor: upgradedToMentor,
              avatar: avatarUrl,
              about: upgradedToMentor ? '我擁有豐富的前端與職涯輔導經驗' : '',
              includeMentorFields: true,
            })
          ),
        })
    );

    await page.route(new RegExp(`/v1/mentors/${USER_ID}/profile$`), (route) => {
      if (route.request().method() === 'PUT') {
        submittedPayload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        upgradedToMentor = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
        });
      }
      return route.fallback();
    });

    await page.goto(`/profile/${USER_ID}/edit?mentor-onboarding=true`);

    // Even though session.user.isMentor is false, ?mentor-onboarding=true
    // unlocks the Mentor-only sections.
    await expect(page.getByText('我能提供的服務')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('專業能力')).toBeVisible();

    // Submitting while '關於我' (about) is empty triggers Mentor validation
    await page.getByRole('button', { name: '儲存' }).click();
    await expect(page.getByText('請填寫關於我')).toBeVisible();
    expect(submittedPayload).toBeNull();

    // Fill '關於我' and submit again
    await page
      .locator('textarea[name="about"]')
      .fill('我擁有豐富的前端與職涯輔導經驗');
    await page.getByRole('button', { name: '儲存' }).click();

    // Should PUT with is_mentor: true and redirect to /profile/card
    await expect(page).toHaveURL('/profile/card', { timeout: 30_000 });
    expect(submittedPayload).not.toBeNull();
    expect(submittedPayload?.['is_mentor']).toBe(true);
    expect(submittedPayload?.['about']).toBe('我擁有豐富的前端與職涯輔導經驗');
  });
});
