import { expect, Page, test } from '@playwright/test';

import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

const USER_ID = '1';
const PAGE_URL = `/profile/${USER_ID}/edit`;

// ─── Mock payloads ───────────────────────────────────────────────────────────

function makeProfile(name: string, isMentor: boolean) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(USER_ID),
      name,
      avatar: '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: '',
      company: '',
      years_of_experience: 'BELOW_ONE_YEAR',
      location: 'TWN',
      personal_statement: '',
      about: isMentor ? '我是 mentor' : '',
      language: 'zh_TW',
      industry: {
        id: 1,
        subject_group: 'TECH',
        subject: '科技業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
      // useEditProfileData.ts reads these as flat subject_group string
      // arrays directly off MentorProfileVO (form.reset({ want_position:
      // userDto.want_position ?? [], ... })) — not the nested
      // { interests: [...] } shape used elsewhere for catalog responses.
      want_position: ['TEST_POS'],
      want_skill: ['TEST_SKILL'],
      want_topic: ['TEST_TOPIC'],
      have_skill: isMentor ? ['TEST_SKILL'] : [],
      have_topic: isMentor ? ['TEST_TOPIC'] : [],
      expertises: {
        professions: isMentor
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
      // Mentor requires at least one work experience, education, and what_i_offer.
      experiences: isMentor
        ? [
            {
              id: 1,
              category: 'WORK',
              order: 1,
              mentor_experiences_metadata: {
                data: [
                  {
                    job: '工程師',
                    company: '測試公司',
                    job_period_start: '2020',
                    job_period_end: '2023',
                    industry: 'TECH',
                    job_location: 'TWN',
                    description: '工作內容',
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
                    school: '測試大學',
                    subject: '資訊工程',
                    education_period_start: '2016',
                    education_period_end: '2020',
                  },
                ],
              },
            },
            {
              id: 4,
              category: 'WHAT_I_OFFER',
              order: 4,
              mentor_experiences_metadata: {
                data: [{ subject_group: 'CAREER_PLANNING' }],
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mock all dropdown option endpoints used by the profile edit page.
 */
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

// ─── Tests ───────────────────────────────────────────────────────────────────

test('未授權使用者（userId 不符）→ 重導向至 /', async ({ page }) => {
  await seedMockAuthSession(page, {
    id: '999',
    name: 'Other User',
    isMentor: false,
    onBoarding: true,
  });

  await page.goto(PAGE_URL);

  await expect(page).toHaveURL('/', { timeout: 10_000 });
});

test('Mentor 使用者載入編輯頁 → mentor 專屬區塊（我能提供的服務、專業能力）可見', async ({
  page,
}) => {
  await seedMockAuthSession(page, {
    id: USER_ID,
    name: 'Test User',
    isMentor: true,
    onBoarding: true,
  });
  await mockApiRoute(page, /\/v1\/mentors\/1\/zh_TW\/profile/, {
    body: makeProfile('Test User', true),
  });
  await mockDropdowns(page);

  await page.goto(PAGE_URL);

  await expect(page.getByText('我能提供的服務')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('專業能力')).toBeVisible();
});

test('Mentee 使用者載入編輯頁 → mentor 專屬區塊不存在', async ({ page }) => {
  await seedMockAuthSession(page, {
    id: USER_ID,
    name: 'Test User',
    isMentor: false,
    onBoarding: true,
  });
  await mockApiRoute(page, /\/v1\/mentors\/1\/zh_TW\/profile/, {
    body: makeProfile('Test User', false),
  });
  await mockDropdowns(page);

  await page.goto(PAGE_URL);

  // Wait for the loading state to clear before asserting absence
  await expect(page.locator('input[name="name"]')).toHaveValue('Test User', {
    timeout: 15_000,
  });
  await expect(page.getByText('我能提供的服務')).not.toBeVisible();
  await expect(page.getByText('專業能力')).not.toBeVisible();
});

test('編輯姓名並儲存 → 重導向至 /profile/:userId', async ({ page }) => {
  await seedMockAuthSession(page, {
    id: USER_ID,
    name: 'Test User',
    isMentor: false,
    onBoarding: true,
  });

  // GETs before the save return the original name; GETs after it (pollUntilSynced)
  // return the updated name so isProfileSynced resolves on the first poll and the
  // test doesn't wait the full 60-second timeout. Keyed on the PUT rather than a
  // call count because the dev server's Strict Mode fires the initial fetch twice.
  let profileSaved = false;
  await page.route(/\/v1\/mentors\/1\/zh_TW\/profile/, (route) => {
    const name = profileSaved ? 'Updated Name' : 'Test User';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeProfile(name, false)),
    });
  });

  await mockDropdowns(page);

  // PUT /v1/mentors/1/profile (no zh_TW segment) → updateProfile success.
  // This pattern does not match the GET zh_TW URL, so the counter handler above
  // remains the sole handler for GET profile calls.
  await page.route(/\/v1\/mentors\/1\/profile/, (route) => {
    profileSaved = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
    });
  });

  await page.goto(PAGE_URL);

  // Wait for the form to be pre-filled with data from the initial profile fetch
  await expect(page.locator('input[name="name"]')).toHaveValue('Test User', {
    timeout: 15_000,
  });

  // Edit the name field
  await page.fill('input[name="name"]', 'Updated Name');

  // Submit the form
  await page.getByRole('button', { name: '儲存' }).click();

  await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 30_000 });

  // 驗證 Header 右上角使用者選單顯示更新後的姓名（useResolvedIdentity 樂觀同步）
  const userMenuTrigger = page
    .getByTestId('desktop-header-right')
    .getByRole('button', { name: '開啟用戶選單' });
  await expect(userMenuTrigger).toBeVisible();
  await userMenuTrigger.click();
  await expect(page.getByTestId('profile-header-button')).toContainText(
    'Updated Name'
  );
});

test('學歷區塊 SearchableSelect 輸入學校別名（台大）可搜尋並選取國立臺灣大學，且輸入自訂學校名稱可選取並送出儲存', async ({
  page,
}) => {
  await seedMockAuthSession(page, {
    id: USER_ID,
    name: 'Test User',
    isMentor: false,
    onBoarding: true,
  });

  interface SavedProfilePayload {
    experiences?: Array<{
      id?: number;
      category?: string;
      order?: number;
      mentor_experiences_metadata?: {
        data?: Array<{
          school?: string;
          subject?: string;
          education_period_start?: string;
          education_period_end?: string;
        }>;
      };
    }>;
  }
  const savedPayloads: SavedProfilePayload[] = [];

  await page.route(/\/v1\/mentors\/1\/zh_TW\/profile/, (route) => {
    const baseProfile = makeProfile('Test User', false);
    const latestPayload = savedPayloads.at(-1);
    const body = latestPayload?.experiences
      ? {
          ...baseProfile,
          data: {
            ...baseProfile.data,
            experiences: latestPayload.experiences,
          },
        }
      : baseProfile;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await mockDropdowns(page);

  await page.route(/\/v1\/mentors\/1\/profile/, async (route) => {
    if (route.request().method() === 'PUT') {
      savedPayloads.push(await route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: '0', msg: 'ok', data: null }),
      });
    }
    return route.fallback();
  });

  await page.goto(PAGE_URL);

  await expect(page.locator('input[name="name"]')).toHaveValue('Test User', {
    timeout: 15_000,
  });

  const educationsSection = page.locator('#educations');
  await educationsSection.getByRole('button', { name: '新增' }).click();

  await educationsSection
    .locator('input[name="educations.0.subject"]')
    .fill('資訊工程學系');

  const schoolCombobox = educationsSection.getByRole('combobox', {
    name: '學校名稱',
  });

  // 1. 輸入學校別名「台大」可搜尋並選取「國立臺灣大學」
  await schoolCombobox.click();
  const schoolSearchInput = page.getByPlaceholder('搜尋學校...');
  await expect(schoolSearchInput).toBeVisible();
  await schoolSearchInput.fill('台大');

  const ntuOption = page.getByRole('option', { name: '國立臺灣大學' });
  await expect(ntuOption).toBeVisible();
  await ntuOption.click();
  await expect(schoolCombobox).toContainText('國立臺灣大學');

  // 2. 輸入不在預設清單內的自訂學校名稱可正常選取
  await schoolCombobox.click();
  await expect(schoolSearchInput).toBeVisible();
  await schoolSearchInput.fill('史丹佛大學');

  const customSchoolOption = page.getByRole('option', {
    name: '新增「史丹佛大學」',
  });
  await expect(customSchoolOption).toBeVisible();
  await customSchoolOption.click();
  await expect(schoolCombobox).toContainText('史丹佛大學');

  // 填寫開始年份（結束年份預設為「迄今」）並送出儲存
  await educationsSection.getByRole('combobox', { name: '開始年份' }).click();
  await page.getByRole('option', { name: '2020' }).click();

  await page.getByRole('button', { name: '儲存' }).click();

  await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 30_000 });
  expect(savedPayloads).toHaveLength(1);
  const educationExp = savedPayloads[0].experiences?.find(
    (exp) => exp.category === 'EDUCATION'
  );
  expect(educationExp?.mentor_experiences_metadata?.data?.[0]).toMatchObject({
    school: '史丹佛大學',
    subject: '資訊工程學系',
    education_period_start: '2020',
  });
});

test('編輯欄位後點擊導航列 → 顯示未儲存變更確認框，取消後留在原頁且輸入內容保留', async ({
  page,
}) => {
  await seedMockAuthSession(page, {
    id: USER_ID,
    name: 'Test User',
    isMentor: false,
    onBoarding: true,
  });
  await mockApiRoute(page, /\/v1\/mentors\/1\/zh_TW\/profile/, {
    body: makeProfile('Test User', false),
  });
  await mockDropdowns(page);

  await page.goto(PAGE_URL);

  await expect(page.locator('input[name="name"]')).toHaveValue('Test User', {
    timeout: 15_000,
  });

  // Dirty the form
  await page.fill('input[name="name"]', 'Unsaved Name');

  // Click the header's cancel/back button - should be intercepted since the
  // form is dirty.
  await page.getByRole('button', { name: '取消' }).click();

  const confirmDialog = page.getByText('尚未儲存的變更');
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(PAGE_URL);

  // Cancel leaving: dialog closes, stays on the edit page, input untouched
  await page.getByRole('button', { name: '繼續編輯' }).click();
  await expect(confirmDialog).not.toBeVisible();
  await expect(page).toHaveURL(PAGE_URL);
  await expect(page.locator('input[name="name"]')).toHaveValue('Unsaved Name');

  // Trigger again and confirm leaving this time
  await page.getByRole('button', { name: '取消' }).click();
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '離開頁面' }).click();

  await expect(page).toHaveURL(`/profile/${USER_ID}`, { timeout: 15_000 });
});
