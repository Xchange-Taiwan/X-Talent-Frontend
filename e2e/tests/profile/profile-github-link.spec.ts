import { expect, type Page, type Route, test } from '@playwright/test';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

// Seeded dev/staging fixture user IDs so Next.js SSR fetchUserByIdServer on
// `/profile/[pageUserId]` resolves a valid record instead of triggering 404,
// while client-side reads/writes are deterministically controlled via browser
// route mocks.
const REAL_MENTEE_ID = '7482008160728087';
const REAL_MENTOR_ID = '7482008160728084';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface LinkMetadataItem {
  platform: string;
  url: string;
}

interface ExperienceItem {
  id?: number;
  category: string;
  order: number;
  mentor_experiences_metadata: {
    data: Array<Record<string, unknown>>;
  };
}

function fulfillCorsOptions(route: Route) {
  return route.fulfill({
    status: 204,
    headers: CORS_HEADERS,
  });
}

function fulfillJsonWithCors(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

function makeProfile(
  userId: string,
  name: string,
  isMentor: boolean,
  links: LinkMetadataItem[]
) {
  const baseExperiences: ExperienceItem[] = isMentor
    ? [
        {
          id: 1,
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: '資深前端工程師',
                company: 'XChange Tech',
                job_period_start: '2021',
                job_period_end: 'now',
                industry: 'SOFTWARE',
                job_location: 'TWN',
                description: '負責設計系統與前端架構建置。',
                is_primary: true,
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
                school: '國立臺灣科技大學',
                subject: '資訊工程系',
                education_period_start: '2017',
                education_period_end: '2021',
              },
            ],
          },
        },
      ]
    : [];

  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(userId),
      name,
      avatar: isMentor ? '/logo.svg' : '',
      onboarding: true,
      is_mentor: isMentor,
      job_title: isMentor ? '資深前端工程師' : 'Frontend Developer',
      company: isMentor ? 'XChange Tech' : 'Startup Studio',
      years_of_experience: isMentor ? 'FIVE_TO_TEN' : 'THREE_TO_FIVE',
      location: 'TWN',
      personal_statement: '',
      about: isMentor
        ? '專注於前端工程與開源社群貢獻，歡迎交流作品集與職涯方向。'
        : '熱愛開源與前端開發。',
      language: 'zh_TW',
      industry: {
        id: 1,
        subject_group: 'SOFTWARE',
        subject: '軟體及網路相關業',
        category: 'INDUSTRY',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
      want_position: ['前端工程師'],
      want_skill: ['TypeScript', 'React'],
      want_topic: ['職涯發展', '作品集健檢'],
      have_skill: isMentor ? ['TypeScript', '前端架構'] : [],
      have_topic: isMentor ? ['職涯發展', '作品集健檢'] : [],
      experiences: [
        ...baseExperiences,
        {
          id: 3,
          category: 'LINK',
          order: 3,
          mentor_experiences_metadata: {
            data: links,
          },
        },
      ],
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
        subject_group: 'SOFTWARE',
        subject: '軟體及網路相關業',
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
        subject_group: '前端架構',
        subject: '前端架構',
        category: 'EXPERTISE',
        language: 'zh_TW',
        profession_metadata: { desc: '', icon: '' },
      },
    ],
  },
};

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
                subject_group: 'TypeScript',
                subject: 'TypeScript',
                language: 'zh_TW',
              },
              {
                tag_id: 2,
                subject_group: 'React',
                subject: 'React',
                language: 'zh_TW',
              },
              {
                tag_id: 3,
                subject_group: '前端架構',
                subject: '前端架構',
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
                tag_id: 4,
                subject_group: '職涯發展',
                subject: '職涯發展',
                language: 'zh_TW',
              },
              {
                tag_id: 5,
                subject_group: '作品集健檢',
                subject: '作品集健檢',
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
                tag_id: 6,
                subject_group: '前端工程師',
                subject: '前端工程師',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      industry: {
        groups: [
          {
            subject_group: 'SOFTWARE',
            subject: '軟體及網路相關業',
            language: 'zh_TW',
            leaves: [],
          },
        ],
      },
    },
  },
};

function makeInterest(subjectGroup: string, subject: string) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      interests: [
        {
          id: 1,
          subject_group: subjectGroup,
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

async function mockProfileDependencies(
  page: Page,
  userId: string,
  options: { isMentor: boolean; name: string }
): Promise<void> {
  const presignedUrlRe = new RegExp(`/v1/storage/presigned-url/${userId}`);
  const scheduleRe = new RegExp(`/v1/mentors/${userId}/schedule/y/`);
  const feedbackRe = new RegExp(`/v1/mentors/${userId}/feedback([?]|$)`);
  const pendingFeedbackRe = new RegExp(
    `/v1/users/${userId}/reservations/pending-feedback`
  );
  const reservationsRe = new RegExp(`/v1/users/${userId}/reservations([?]|$)`);

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
  await mockApiRoute(page, presignedUrlRe, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        url: 'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
        fields: {
          key: `avatars/${userId}/avatar.png`,
          AWSAccessKeyId: 'mock-key',
          policy: 'mock-policy',
          signature: 'mock-sig',
        },
      },
    },
  });
  await mockApiRoute(page, /\/v1\/users\/.*\/notifications\/unread-count/, {
    body: { code: '0', msg: 'ok', data: { unread_count: 0 } },
  });
  await mockApiRoute(page, /\/v1\/users\/[^/]+\/favorite-mentors(\?|$)/, {
    body: { code: '0', msg: 'ok', data: [] },
  });
  await mockApiRoute(page, scheduleRe, {
    body: { code: '0', msg: 'ok', data: { segments: [], slots: [] } },
  });
  await mockApiRoute(page, feedbackRe, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        feedbacks: [],
        items: [],
        total_rating_count: 0,
        rating_average: null,
        completed_meeting_count: 0,
        page: 1,
        page_size: 10,
      },
    },
  });
  await mockApiRoute(page, pendingFeedbackRe, {
    body: { code: '0', msg: 'ok', data: { items: [] } },
  });
  await mockApiRoute(page, reservationsRe, {
    body: { code: '0', msg: 'ok', data: { reservations: [] } },
  });
  await mockApiRoute(page, /\/v1\/mentors(\?|$)/, {
    body: {
      code: '0',
      msg: 'ok',
      data: {
        mentors: options.isMentor
          ? [
              {
                user_id: Number(userId),
                name: options.name,
                avatar: '/logo.svg',
                job_title: '資深前端工程師',
                company: 'XChange Tech',
                years_of_experience: 'FIVE_TO_TEN',
                location: 'TWN',
                linkedin_profile: '',
                interested_positions: ['前端工程師'],
                skills: ['TypeScript', '前端架構'],
                topics: ['職涯發展', '作品集健檢'],
                want_position: ['前端工程師'],
                want_skill: ['TypeScript', 'React'],
                want_topic: ['職涯發展', '作品集健檢'],
                have_skill: ['TypeScript', '前端架構'],
                have_topic: ['職涯發展', '作品集健檢'],
                industry: '軟體及網路相關業',
                language: 'zh_TW',
                personal_statement: '',
                about:
                  '專注於前端工程與開源社群貢獻，歡迎交流作品集與職涯方向。',
                seniority_level: 'SENIOR',
                expertises: ['前端架構'],
                experiences: [],
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-11-01T00:00:00Z',
              },
            ]
          : [],
        next_id: 0,
      },
    },
  });
  await page.route(/\/v1\/users\/zh_TW\/interests/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return fulfillCorsOptions(route);
    }
    const url = route.request().url();
    if (url.includes('INTERESTED_POSITION')) {
      return fulfillJsonWithCors(
        route,
        makeInterest('前端工程師', '前端工程師')
      );
    }
    if (url.includes('SKILL')) {
      return fulfillJsonWithCors(
        route,
        makeInterest('TypeScript', 'TypeScript')
      );
    }
    if (url.includes('TOPIC')) {
      return fulfillJsonWithCors(route, makeInterest('職涯發展', '職涯發展'));
    }
    return route.fallback();
  });
}

test('Mentee 編輯頁顯示 7 個順序正確的個人連結欄位，阻擋非 github.com 網址，儲存後保留 Facebook 並在個人頁顯示 GitHub 外連圖示', async ({
  page,
}) => {
  const userId = REAL_MENTEE_ID;
  const editUrl = `/profile/${userId}/edit`;
  const viewUrl = `/profile/${userId}`;

  await seedMockAuthSession(page, {
    id: userId,
    name: '陳小明',
    isMentor: false,
    onBoarding: true,
  });

  let currentLinks: LinkMetadataItem[] = [
    { platform: 'facebook', url: 'https://www.facebook.com/xiaoming' },
    { platform: 'website', url: 'https://xiaoming.dev' },
  ];
  let putCount = 0;

  await page.route(
    new RegExp(`/v1/(?:mentors|users)/${userId}/zh_TW/profile`),
    (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      return fulfillJsonWithCors(
        route,
        makeProfile(userId, '陳小明', false, currentLinks)
      );
    }
  );

  await mockProfileDependencies(page, userId, {
    isMentor: false,
    name: '陳小明',
  });

  await page.route(
    new RegExp(`/v1/mentors/${userId}/profile$`),
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      if (route.request().method() === 'PUT') {
        putCount += 1;
        const body: {
          experiences?: Array<{
            category?: string;
            mentor_experiences_metadata?: { data?: LinkMetadataItem[] };
          }>;
        } = await route.request().postDataJSON();
        const savedLinkExp = body.experiences?.find(
          (e) => e.category === 'LINK'
        );
        currentLinks = savedLinkExp?.mentor_experiences_metadata?.data ?? [];
        return fulfillJsonWithCors(route, {
          code: '0',
          msg: 'ok',
          data: null,
        });
      }
      return route.fallback();
    }
  );

  await page.goto(editUrl);

  await expect(page.locator('input[name="name"]')).toHaveValue('陳小明', {
    timeout: 15_000,
  });

  const linksSection = page.locator('#links');
  await expect(linksSection).toBeVisible();
  await expect(linksSection.locator('input')).toHaveCount(7);

  // 驗證 7 個欄位顯示順序：LinkedIn、Facebook、Instagram、X、YouTube、GitHub、個人網站
  const fieldNames = await linksSection
    .locator('input')
    .evaluateAll((inputs) => inputs.map((el) => el.getAttribute('name')));
  expect(fieldNames).toEqual([
    'links.linkedin',
    'links.facebook',
    'links.instagram',
    'links.twitter',
    'links.youtube',
    'links.github',
    'links.website',
  ]);

  // 既有 Facebook 連結保留不變
  await expect(
    linksSection.locator('input[name="links.facebook"]')
  ).toHaveValue('https://www.facebook.com/xiaoming');

  // 填入非 github.com 網址時，顯示格式錯誤提示且不可送出儲存
  const githubInput = linksSection.locator('input[name="links.github"]');
  await githubInput.fill('https://gitlab.com/xiaoming');
  await page.getByRole('button', { name: '儲存' }).click();

  const errorMessage = linksSection.getByText(
    '請輸入有效的 GitHub HTTPS 網址（允許網域：github.com）'
  );
  await expect(errorMessage).toBeVisible();
  expect(putCount).toBe(0);

  await page.locator('input[name="links.website"]').scrollIntoViewIfNeeded();
  await captureEvidence(page, 'profile-edit-links-github-validation-error');

  // 改填省略 https:// 的 github.com 網址，可正常儲存並自動補齊 https://
  await githubInput.fill('github.com/xiaoming');
  await expect(errorMessage).not.toBeVisible();

  await page.locator('input[name="links.website"]').scrollIntoViewIfNeeded();
  await captureEvidence(page, 'profile-edit-links-github-filled');

  await page.getByRole('button', { name: '儲存' }).click();

  await expect(page).toHaveURL(viewUrl, { timeout: 30_000 });
  expect(putCount).toBe(1);
  expect(currentLinks).toEqual([
    { platform: 'facebook', url: 'https://www.facebook.com/xiaoming' },
    { platform: 'github', url: 'https://github.com/xiaoming' },
    { platform: 'website', url: 'https://xiaoming.dev' },
  ]);

  const main = page.getByRole('main');
  await expect(main.getByText('陳小明', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const facebookLink = main.getByRole('link', {
    name: 'Facebook',
    exact: true,
  });
  const githubLink = main.getByRole('link', { name: 'GitHub', exact: true });
  const websiteLink = main.getByRole('link', {
    name: '個人網站',
    exact: true,
  });

  await expect(facebookLink).toBeVisible();
  await expect(githubLink).toBeVisible();
  await expect(websiteLink).toBeVisible();
  await expect(githubLink).toHaveAttribute(
    'href',
    'https://github.com/xiaoming'
  );
  await expect(githubLink).toHaveAttribute('target', '_blank');
  await expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');

  await page.evaluate(() => window.scrollTo(0, 0));
  await captureEvidence(page, 'mentee-profile-view-github-link');
});

test('Mentor 編輯頁與導師個人頁均顯示 7 個平台個人連結（含 GitHub 位於 YouTube 與個人網站之間）', async ({
  page,
}) => {
  const userId = REAL_MENTOR_ID;
  const editUrl = `/profile/${userId}/edit`;
  const viewUrl = `/profile/${userId}`;

  await seedMockAuthSession(page, {
    id: userId,
    name: '林導師',
    avatar: '/logo.svg',
    isMentor: true,
    onBoarding: true,
  });

  let currentLinks: LinkMetadataItem[] = [
    { platform: 'linkedin', url: 'https://www.linkedin.com/in/mentor-lin' },
    { platform: 'facebook', url: 'https://www.facebook.com/mentor-lin' },
    { platform: 'instagram', url: 'https://www.instagram.com/mentor.lin' },
    { platform: 'twitter', url: 'https://x.com/mentorlin' },
    { platform: 'youtube', url: 'https://www.youtube.com/@mentorlin' },
    { platform: 'website', url: 'https://mentorlin.dev' },
  ];

  await page.route(
    new RegExp(`/v1/(?:mentors|users)/${userId}/zh_TW/profile`),
    (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      return fulfillJsonWithCors(
        route,
        makeProfile(userId, '林導師', true, currentLinks)
      );
    }
  );

  await mockProfileDependencies(page, userId, {
    isMentor: true,
    name: '林導師',
  });

  await page.route(
    new RegExp(`/v1/mentors/${userId}/profile$`),
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      if (route.request().method() === 'PUT') {
        const body: {
          experiences?: Array<{
            category?: string;
            mentor_experiences_metadata?: { data?: LinkMetadataItem[] };
          }>;
        } = await route.request().postDataJSON();
        const savedLinkExp = body.experiences?.find(
          (e) => e.category === 'LINK'
        );
        currentLinks = savedLinkExp?.mentor_experiences_metadata?.data ?? [];
        return fulfillJsonWithCors(route, {
          code: '0',
          msg: 'ok',
          data: null,
        });
      }
      return route.fallback();
    }
  );

  await page.goto(editUrl);

  await expect(page.getByText('我能提供的服務')).toBeVisible({
    timeout: 15_000,
  });

  const linksSection = page.locator('#links');
  const githubInput = linksSection.locator('input[name="links.github"]');
  await githubInput.scrollIntoViewIfNeeded();
  await expect(githubInput).toBeVisible();

  await githubInput.fill('https://github.com/mentor-lin');
  await page.getByRole('button', { name: '儲存' }).click();

  await expect(page).toHaveURL(viewUrl, { timeout: 30_000 });

  const main = page.getByRole('main');
  await expect(main.getByText('林導師', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const headerSocialLinks = main.locator(
    'a[data-analytics-click="profile_social_link"]'
  );
  await expect(headerSocialLinks).toHaveCount(7);

  const renderedLabels = await headerSocialLinks.evaluateAll((anchors) =>
    anchors.map((a) => a.getAttribute('aria-label'))
  );
  expect(renderedLabels).toEqual([
    'LinkedIn',
    'Facebook',
    'Instagram',
    'X (formerly Twitter)',
    'YouTube',
    'GitHub',
    '個人網站',
  ]);

  const githubLink = main.getByRole('link', { name: 'GitHub', exact: true });
  await expect(githubLink).toBeVisible();
  await expect(githubLink).toHaveAttribute(
    'href',
    'https://github.com/mentor-lin'
  );
  await expect(githubLink).toHaveAttribute('target', '_blank');

  await page.evaluate(() => window.scrollTo(0, 0));
  await captureEvidence(page, 'mentor-profile-view-github-link');
});
