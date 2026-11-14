import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

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

const MOCK_TAG_CATALOG = {
  code: '0',
  msg: 'ok',
  data: {
    catalogs: {
      skill: {
        groups: [
          {
            subject_group: 'SKILL_GROUP',
            subject: '技術能力',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 'TEST_SKILL',
                subject: '測試技能',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      topic: {
        groups: [
          {
            subject_group: 'TOPIC_GROUP',
            subject: '服務主題',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 2,
                subject_group: 'TEST_TOPIC',
                subject: '測試主題',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      position: {
        groups: [
          {
            subject_group: 'POS_GROUP',
            subject: '工程職位',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 3,
                subject_group: 'TEST_POS',
                subject: '測試職位',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      industry: {
        groups: [
          {
            subject_group: 'TECH',
            subject: '科技業',
            language: 'zh_TW',
            leaves: [],
          },
        ],
      },
    },
  },
};

async function seedProfileUser(
  page: Page,
  isMentor: boolean,
  avatar = ''
): Promise<void> {
  await seedMockAuthSession(page, {
    id: USER_ID,
    name: 'Test Mentee',
    avatar,
    isMentor,
    onBoarding: true,
    jobTitle: 'Frontend Engineer',
    company: 'XChange',
  });
}

async function mockDropdowns(page: Page): Promise<void> {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
    body: MOCK_TAG_CATALOG,
  });
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

async function cropAndConfirmAvatar(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"][accept="image/*"]');
  await fileInput.setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: TINY_PNG_BUFFER,
  });

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
}

test.describe('Profile Avatar Upload, Card Page & Become Mentor E2E (#790)', () => {
  test('選擇圖片開啟剪裁彈窗 → 儲存後觸發 S3 Presigned POST 並將新頭像網址送入 PUT /profile', async ({
    page,
  }) => {
    await seedProfileUser(page, false);
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
      (url) => url.origin === S3_BUCKET_URL,
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

    await cropAndConfirmAvatar(page);

    // Background upload should immediately POST to the presigned S3 URL
    await expect.poll(() => s3PostCalled).toBe(true);

    // Submit the profile form and verify PUT /profile receives the uploaded S3 URL
    await page.getByRole('button', { name: '儲存' }).click();

    await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 30_000 });
    const expectedPrefix = `${S3_BUCKET_URL}/${S3_OBJECT_KEY}?v=`;
    expect(savedAvatarUrl.startsWith(expectedPrefix)).toBe(true);
    expect(savedAvatarUrl.slice(expectedPrefix.length)).toMatch(/^\d+$/);
  });

  test('S3 上傳失敗時顯示錯誤提示且不送出 PUT /profile；取消編輯離開時觸發 S3 頭像快照還原', async ({
    page,
  }) => {
    const initialAvatarUrl = `${S3_BUCKET_URL}/avatars/${USER_ID}/original-avatar.png`;
    await seedProfileUser(page, false, initialAvatarUrl);
    await mockDropdowns(page);

    let shouldFailS3Post = true;
    let s3PostCount = 0;
    let snapshotGetCount = 0;
    let putProfileCalled = false;

    await page.route(
      new RegExp(`/v1/storage/presigned-url/${USER_ID}`),
      (route) =>
        route.fulfill({
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
        })
    );

    await page.route(
      (url) => url.origin === S3_BUCKET_URL,
      (route) => {
        if (route.request().method() === 'POST') {
          s3PostCount += 1;
          if (shouldFailS3Post) {
            return route.fulfill({ status: 500, body: 'S3 Internal Error' });
          }
          return route.fulfill({ status: 204, body: '' });
        }
        snapshotGetCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: TINY_PNG_BUFFER,
        });
      }
    );

    await mockApiRoute(
      page,
      new RegExp(`/v1/mentors/${USER_ID}/zh_TW/profile`),
      {
        body: makeProfile({ avatar: initialAvatarUrl }),
      }
    );

    await page.route(new RegExp(`/v1/mentors/${USER_ID}/profile$`), (route) => {
      if (route.request().method() === 'PUT') {
        putProfileCalled = true;
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

    // 1. S3 POST fails with 500 → clicking 儲存 shows error toast and blocks PUT /profile
    await cropAndConfirmAvatar(page);
    await expect.poll(() => s3PostCount).toBe(1);

    await page.getByRole('button', { name: '儲存' }).click();
    await expect(
      page.getByText('儲存失敗，請稍後再試', { exact: true })
    ).toBeVisible();
    expect(putProfileCalled).toBe(false);

    // 2. Re-crop with S3 succeeding, then click 取消 → 離開頁面 triggers rollback S3 POST
    shouldFailS3Post = false;
    await cropAndConfirmAvatar(page);
    await expect.poll(() => s3PostCount).toBe(2);
    expect(snapshotGetCount).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: '取消' }).click();
    const unsavedDialog = page.getByRole('dialog', { name: '尚未儲存的變更' });
    await expect(unsavedDialog).toBeVisible();
    await unsavedDialog.getByRole('button', { name: '離開頁面' }).click();

    // Rollback re-uploads the original avatar snapshot to S3 and navigates back to /profile/:id
    await expect.poll(() => s3PostCount).toBe(3);
    await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 15_000 });
    expect(putProfileCalled).toBe(false);
  });

  test('Mentee 造訪 /profile/card → 顯示完成個人頁面訊息與「成為導師」、「開始探索 X-Talent」導向', async ({
    page,
  }) => {
    await seedProfileUser(page, false);
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
      page.getByText('現在你可以開始探索導師，或只需一步即可建立你的導師檔案')
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Test Mentee' })
    ).toBeVisible();

    const becomeMentorBtn = page.getByRole('button', { name: '成為導師' });
    const exploreBtn = page.getByRole('button', { name: '開始探索 X-Talent' });
    await expect(becomeMentorBtn).toBeVisible();
    await expect(exploreBtn).toBeVisible();

    // Click 成為導師 → navigates to /profile/:id/edit?mentor-onboarding=true
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
    await seedProfileUser(page, true);

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
      page.getByRole('button', { name: '成為導師' })
    ).not.toBeVisible();

    const backToProfileBtn = page.getByRole('button', {
      name: '返回我的個人頁面',
    });
    await expect(backToProfileBtn).toBeVisible();
    await backToProfileBtn.click();

    await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 15_000 });
  });

  test('Mentee 進入 ?mentor-onboarding=true → 透過 UI 補齊所有 Mentor 必填欄位後以 is_mentor=true 送出，並可於 /mentor-pool 搜尋', async ({
    page,
  }) => {
    const avatarUrl = `${S3_BUCKET_URL}/${S3_OBJECT_KEY}`;
    await seedProfileUser(page, false, avatarUrl);
    await mockDropdowns(page);

    await page.route(
      (url) => url.origin === S3_BUCKET_URL,
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
              includeMentorFields: upgradedToMentor,
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

    // Wait for dynamic sections (JobExperienceSection & EducationSection) to mount
    const workSection = page.locator('#work_experiences');
    const eduSection = page.locator('#educations');
    await expect(workSection.getByRole('button', { name: '新增' })).toBeVisible(
      { timeout: 15_000 }
    );
    await expect(eduSection.getByRole('button', { name: '新增' })).toBeVisible({
      timeout: 15_000,
    });

    // Submitting while Mentor-only required fields are empty triggers validation errors
    await page.getByRole('button', { name: '儲存' }).click();
    await expect(page.getByText('請填寫關於我')).toBeVisible();
    await expect(page.getByText('請至少選擇一個主題')).toBeVisible();
    await expect(page.getByText('請至少選擇一個技能')).toBeVisible();
    await expect(page.getByText('請填寫至少一項工作經歷')).toBeVisible();
    await expect(page.getByText('請填寫至少一項學歷')).toBeVisible();
    expect(submittedPayload).toBeNull();

    // 1. Fill '關於我'
    await page
      .locator('textarea[name="about"]')
      .fill('我擁有豐富的前端與職涯輔導經驗');

    // 2. Select at least one topic in '我能提供的服務' (#have_topic)
    await page
      .locator('#have_topic .max-h-80 button[type="button"]')
      .first()
      .click();
    await page.locator('#have_topic [role="checkbox"]').first().click();

    // 3. Select at least one skill in '專業能力' (#have_skill)
    await page
      .locator('#have_skill .max-h-80 button[type="button"]')
      .first()
      .click();
    await page.locator('#have_skill [role="checkbox"]').first().click();

    // 4. Add and fill a work experience entry (#work_experiences)
    await workSection.getByRole('button', { name: '新增' }).click();
    await workSection
      .locator('input[name="work_experiences.0.job"]')
      .fill('Senior Frontend Engineer');
    await workSection
      .locator('input[name="work_experiences.0.company"]')
      .fill('XChange');
    await workSection
      .locator('button[role="combobox"]')
      .filter({ hasText: '請選擇年份' })
      .first()
      .click();
    await page.getByRole('option', { name: '2021' }).click();
    await workSection
      .locator('button[role="combobox"]')
      .filter({ hasText: '請選擇產業' })
      .click();
    await page.getByRole('option').first().click();
    await workSection
      .locator('textarea[name="work_experiences.0.description"]')
      .fill('負責設計系統與前端架構');

    // 5. Add and fill an education entry (#educations)
    await eduSection.getByRole('button', { name: '新增' }).click();
    await eduSection
      .getByRole('combobox')
      .filter({ hasText: '請選擇學校' })
      .click();
    await page.getByRole('option', { name: '國立臺灣大學' }).click();
    await eduSection
      .locator('input[name="educations.0.subject"]')
      .fill('資訊工程學系');
    await eduSection
      .locator('button[role="combobox"]')
      .filter({ hasText: '請選擇年份' })
      .first()
      .click();
    await page.getByRole('option', { name: '2017' }).click();

    // Submit the completed Mentor onboarding form
    await page.getByRole('button', { name: '儲存' }).click();

    // Should PUT with is_mentor: true and redirect to /profile/card
    await expect(page).toHaveURL('/profile/card', { timeout: 30_000 });
    expect(submittedPayload).not.toBeNull();
    expect(submittedPayload?.['is_mentor']).toBe(true);
    expect(submittedPayload?.['about']).toBe('我擁有豐富的前端與職涯輔導經驗');
    expect(
      Array.isArray(submittedPayload?.['have_topic']) &&
        (submittedPayload?.['have_topic'] as unknown[]).length > 0
    ).toBe(true);
    expect(
      Array.isArray(submittedPayload?.['have_skill']) &&
        (submittedPayload?.['have_skill'] as unknown[]).length > 0
    ).toBe(true);
    expect(
      Array.isArray(submittedPayload?.['experiences']) &&
        (submittedPayload?.['experiences'] as unknown[]).length >= 2
    ).toBe(true);

    // Verify /profile/card displays Mentor completion state
    await expect(page.getByText('恭喜！', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Verify the upgraded Mentor can be searched and found in /mentor-pool
    await page.route(/\/v1\/mentors(\?|$)/, (route, request) => {
      const keyword = new URL(request.url()).searchParams.get('search_pattern');
      const mentors =
        keyword === 'Test Mentee'
          ? [
              {
                user_id: Number(USER_ID),
                name: 'Test Mentee',
                avatar: '',
                job_title: 'Senior Frontend Engineer',
                company: 'XChange',
                years_of_experience: 'ONE_TO_THREE_YEARS',
                location: 'TWN',
                linkedin_profile: '',
                interested_positions: ['TEST_POS'],
                skills: ['TEST_SKILL'],
                topics: ['TEST_TOPIC'],
                industry: '科技業',
                language: 'zh_TW',
                personal_statement: '熱愛前端開發與職涯交流',
                about: '我擁有豐富的前端與職涯輔導經驗',
                seniority_level: 'SENIOR',
                expertises: ['資料分析'],
                experiences: [],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
              },
            ]
          : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '0',
          msg: 'ok',
          data: { mentors, next_id: 0 },
        }),
      });
    });

    await page.goto('/mentor-pool?q=initial');
    const searchInput = page.locator(
      'input[placeholder="搜尋有興趣職位、公司或是想精進的領域"]'
    );
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
    await searchInput.fill('Test Mentee');
    await page.getByRole('button', { name: '搜尋' }).click();

    const mentorCard = page
      .locator('article')
      .filter({ hasText: 'Test Mentee' });
    await expect(mentorCard).toBeVisible({ timeout: 15_000 });
    await expect(mentorCard).toContainText('Senior Frontend Engineer');
  });
});
