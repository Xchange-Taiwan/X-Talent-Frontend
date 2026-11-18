import { expect, type Page, type Route, test } from '@playwright/test';
import path from 'path';

import { captureEvidence } from '../../helpers/evidence';
import { mockApiRoute } from '../../helpers/route';
import { seedMockAuthSession } from '../../helpers/session';

const REAL_MENTEE_ID = '7482008160728087';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function fulfillCorsOptions(route: Route) {
  return route.fulfill({ status: 204, headers: CORS_HEADERS });
}

function fulfillJsonWithCors(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

// Aligned 1:1 with canonical backend tag catalog groups & leaves so both SSR
// initialCatalogs and browser-mocked catalog fetches present identical labels.
const MOCK_TAG_CATALOG = {
  code: '0',
  msg: 'ok',
  data: {
    catalogs: {
      position: {
        groups: [
          {
            subject_group: 'software_dev',
            subject: '軟體開發',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 'ai_engineer',
                subject: 'AI 工程師',
                language: 'zh_TW',
              },
              {
                tag_id: 2,
                subject_group: 'backend_engineer',
                subject: '後端工程師',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      skill: {
        groups: [
          {
            subject_group: 'software_dev',
            subject: '軟體開發',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 11,
                subject_group: 'ai_coding',
                subject: 'AI Coding',
                language: 'zh_TW',
              },
              {
                tag_id: 12,
                subject_group: 'automation_testing',
                subject: '自動化測試',
                language: 'zh_TW',
              },
              {
                tag_id: 13,
                subject_group: 'backend_development',
                subject: '後端開發',
                language: 'zh_TW',
              },
            ],
          },
        ],
      },
      topic: {
        groups: [
          {
            subject_group: 'career_skill_dev',
            subject: '求職技能發展',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 21,
                subject_group: 'portfolio_guidance',
                subject: '求職作品指導',
                language: 'zh_TW',
              },
              {
                tag_id: 22,
                subject_group: 'interview_skills',
                subject: '面試說話技巧',
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
            subject: '科技 / 軟體 / 半導體',
            language: 'zh_TW',
            leaves: [],
          },
        ],
      },
    },
  },
};

function makeMenteeProfileFromBody(
  userId: string,
  payload: Record<string, unknown> | null
) {
  return {
    code: '0',
    msg: 'ok',
    data: {
      user_id: Number(userId),
      name: String(payload?.name ?? '林小英'),
      avatar: String(payload?.avatar ?? ''),
      onboarding: true,
      is_mentor: false,
      job_title: String(payload?.job_title ?? 'UI/UX 設計師'),
      company: String(payload?.company ?? '新創科技'),
      years_of_experience: String(payload?.years_of_experience ?? '3_5'),
      location: String(payload?.location ?? 'TWN'),
      personal_statement: '',
      about: String(
        payload?.about ?? '3 年 UI/UX 設計經驗，正在準備轉職軟體工程師。'
      ),
      language: 'zh_TW',
      industry: payload?.industry
        ? {
            id: 1,
            subject_group: String(payload.industry),
            subject: '科技 / 軟體 / 半導體',
            category: 'INDUSTRY',
            language: 'zh_TW',
          }
        : null,
      want_position: (payload?.want_position as string[]) ?? ['ai_engineer'],
      want_skill: (payload?.want_skill as string[]) ?? ['ai_coding'],
      want_topic: (payload?.want_topic as string[]) ?? ['portfolio_guidance'],
      have_skill: [],
      have_topic: [],
      experiences: (payload?.experiences as unknown[]) ?? [],
    },
  };
}

async function captureFocusRingCrop(
  page: Page,
  selector: string,
  outDir: string | undefined,
  fileName: string
) {
  if (!outDir) return;
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  // Trigger keyboard focus-visible modality via Tab or focus
  await page.keyboard.press('Tab');
  await el.focus();
  const box = await el.boundingBox();
  if (!box) return;
  const pad = 16;
  await page.screenshot({
    path: path.join(outDir, fileName),
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
}

async function setupMenteeMocks(page: Page, userId: string) {
  await mockApiRoute(page, /\/v1\/users\/zh_TW\/tags\/catalog/, {
    body: MOCK_TAG_CATALOG,
  });
  await mockApiRoute(page, new RegExp(`/v1/storage/presigned-url/${userId}`), {
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
  await mockApiRoute(page, new RegExp(`/v1/mentors/${userId}/schedule/y/`), {
    body: { code: '0', msg: 'ok', data: { segments: [], slots: [] } },
  });
  await mockApiRoute(
    page,
    new RegExp(`/v1/users/${userId}/reservations/pending-feedback`),
    { body: { code: '0', msg: 'ok', data: [] } }
  );
  await mockApiRoute(
    page,
    new RegExp(`/v1/users/${userId}/reservations([?]|$)`),
    { body: { code: '0', msg: 'ok', data: { reservations: [] } } }
  );
}

test('Mentee 個人頁原地編輯 (#828)：B-1 單一編輯按鈕、6 款預設頭像免 S3 上傳、依方向選技能與主題、經歷摘要摺疊與未儲存攔截', async ({
  page,
}) => {
  const userId = REAL_MENTEE_ID;
  const focusCropDir = process.env.FOCUS_CROP_OUT_DIR;
  let s3PostCount = 0;
  let lastPutBody = null as Record<string, unknown> | null;

  await seedMockAuthSession(page, {
    id: userId,
    name: '林小英',
    isMentor: false,
    onBoarding: true,
  });

  await setupMenteeMocks(page, userId);

  await page.route(
    (url) =>
      url.origin ===
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
    (route) => {
      if (route.request().method() === 'POST') {
        s3PostCount += 1;
      }
      return route.fulfill({ status: 204, body: '' });
    }
  );

  await page.route(
    new RegExp(`/v1/(?:mentors|users)/${userId}/zh_TW/profile`),
    (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      return fulfillJsonWithCors(
        route,
        makeMenteeProfileFromBody(userId, lastPutBody)
      );
    }
  );

  await page.route(
    new RegExp(`/v1/mentors/${userId}/profile$`),
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfillCorsOptions(route);
      }
      if (route.request().method() === 'PUT') {
        lastPutBody = (await route.request().postDataJSON()) as Record<
          string,
          unknown
        >;
        return fulfillJsonWithCors(route, { code: '0', msg: 'ok', data: null });
      }
      return route.fallback();
    }
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/profile/${userId}`);
  const main = page.getByRole('main');

  // B-1: 僅保留「編輯個人資訊」，個人頁不出現「成為導師」或「分享個人頁面」按鈕
  const editBtn = main.getByRole('button', { name: '編輯個人資訊' });
  await expect(editBtn).toBeVisible({ timeout: 15_000 });
  await expect(
    main.getByRole('button', { name: '成為導師' })
  ).not.toBeVisible();
  await expect(
    main.getByRole('button', { name: '分享個人頁面' })
  ).not.toBeVisible();

  // 點擊「編輯個人資訊」→ 同頁切換成 B-2 原地編輯（網址維持 /profile/:id）
  await editBtn.click();
  await expect(page).toHaveURL(`/profile/${userId}`);
  await expect(main.getByRole('button', { name: '儲存' })).toHaveCount(2);
  await expect(main.getByRole('button', { name: '取消' })).toHaveCount(2);
  await expect(main.getByText('我能提供的服務')).not.toBeVisible();
  await expect(main.getByText('專業能力')).not.toBeVisible();

  // 更新姓名與關於我
  const nameInput = main.getByLabel('姓名');
  await nameInput.fill('林小英');
  await expect(main.getByText('3/20')).toBeVisible();
  await captureFocusRingCrop(
    page,
    'input[name="name"]',
    focusCropDir,
    'focus-crop-name-input.png'
  );

  await main
    .getByTestId('mentee-section-about')
    .locator('textarea')
    .fill('3 年 UI/UX 設計經驗，正在準備轉職後端與全端工程師。');
  await captureFocusRingCrop(
    page,
    '[data-testid="mentee-section-about"] textarea',
    focusCropDir,
    'focus-crop-about-textarea.png'
  );

  // 開啟「編輯頭像」視窗並選用第 3 款預設插畫頭像
  await main.getByRole('button', { name: '編輯個人頭像' }).click();
  const avatarDialog = page.getByRole('dialog', { name: '編輯頭像' });
  await expect(avatarDialog).toBeVisible();
  await avatarDialog.getByRole('button', { name: '預設頭像 3' }).click();
  await expect(
    avatarDialog.getByRole('button', { name: '預設頭像 3' })
  ).toHaveAttribute('aria-pressed', 'true');

  await captureFocusRingCrop(
    page,
    '[role="dialog"] button[aria-label="預設頭像 3"]',
    focusCropDir,
    'focus-crop-preset-avatar.png'
  );
  await captureEvidence(page, 'mentee-avatar-dialog-presets');

  await avatarDialog.getByRole('button', { name: '儲存頭像' }).click();
  await expect(avatarDialog).not.toBeVisible();

  // 交流偏好：挑選「後端工程師」職位方向，並在該方向挑選技能與主題
  const prefSection = main.getByTestId('mentee-section-preferences');
  await prefSection
    .getByRole('button', { name: /軟體開發/ })
    .first()
    .click();
  await prefSection.getByText('後端工程師', { exact: true }).first().click();

  const dirPanel = main.getByTestId('mentee-direction-panel');
  await dirPanel.getByRole('tab', { name: '後端工程師' }).click();
  await captureFocusRingCrop(
    page,
    '[data-testid="mentee-direction-panel"] [role="tab"][aria-selected="true"]',
    focusCropDir,
    'focus-crop-direction-tab.png'
  );
  await dirPanel.getByRole('button', { name: /軟體開發/ }).click();
  await dirPanel.getByText('後端開發', { exact: true }).click();
  await dirPanel.getByRole('button', { name: /求職技能發展/ }).click();
  await dirPanel.getByText('面試說話技巧', { exact: true }).click();

  // 工作經驗：新增一筆主要工作經驗並收合為摘要列
  const workSection = main.getByTestId('mentee-section-work');
  const existingEditBtn = workSection.getByRole('button', { name: '編輯' });
  if ((await existingEditBtn.count()) === 0) {
    await workSection.getByRole('button', { name: /新增/ }).click();
    await workSection
      .getByRole('textbox', { name: '職稱', exact: true })
      .fill('UI/UX 設計師');
    await workSection
      .getByRole('textbox', { name: '公司名稱', exact: true })
      .fill('新創科技');
    await workSection.getByText('請選擇年份').first().click();
    await page.getByRole('option', { name: '2022' }).click();
    await workSection.getByText('請選擇產業').click();
    await page.getByRole('option').first().click();
    await workSection
      .getByRole('textbox', { name: '描述', exact: true })
      .fill('負責產品設計與使用者研究。');
    await workSection.getByRole('button', { name: '收合' }).click();
  }
  await expect(
    workSection.getByText('頁面顯示的職稱', { exact: true })
  ).toBeVisible();
  await expect(
    workSection.getByRole('textbox', { name: '職稱', exact: true })
  ).not.toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await captureEvidence(page, 'mentee-inplace-edit-b2');

  // 儲存後維持在同頁並切回 B-1 檢視模式，且預設頭像零 S3 上傳、無 ?cb= 參數
  await main.getByRole('button', { name: '儲存' }).first().click();

  await expect(main.getByRole('button', { name: '編輯個人資訊' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(main.getByText('林小英')).toBeVisible();
  await expect(main.getByText('UI/UX 設計師 at 新創科技')).toBeVisible();

  const savedAvatarImg = main.locator('img[alt="Avatar of 林小英"]');
  await expect(savedAvatarImg).toBeVisible();
  const renderedSrc = (await savedAvatarImg.getAttribute('src')) ?? '';
  expect(renderedSrc).toContain('default_3.webp');
  expect(renderedSrc).not.toContain('cb=');

  expect(s3PostCount).toBe(0);
  expect(lastPutBody).toMatchObject({
    name: '林小英',
    avatar: '/avatars/default_3.webp',
  });
  expect(lastPutBody?.want_position).toContain('backend_engineer');
  expect(lastPutBody?.want_skill).toContain('backend_development');
  expect(lastPutBody?.want_topic).toContain('interview_skills');

  await captureEvidence(page, 'mentee-profile-b1-after-save');

  // 再次點「編輯個人資訊」並修改姓名後按「取消」→ 驗證未儲存變更攔截彈窗
  await main.getByRole('button', { name: '編輯個人資訊' }).click();
  await main.getByLabel('姓名').fill('未儲存修改');
  await main.getByRole('button', { name: '取消' }).first().click();
  const unsavedDialog = page.getByRole('dialog', { name: '尚未儲存的變更' });
  await expect(unsavedDialog).toBeVisible();
  await unsavedDialog.getByRole('button', { name: '離開頁面' }).click();
  await expect(
    main.getByRole('button', { name: '編輯個人資訊' })
  ).toBeVisible();
});
