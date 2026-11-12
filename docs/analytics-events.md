# X-Talent Frontend 數據埋點規範與事件總表 (`docs/analytics-events.md`)

本文件為 `X-Talent-Frontend` 前端行為追蹤（Google Analytics 4 與 Microsoft Clarity）之單一規格參考，涵蓋架構設計、基礎事件（`page_view`、`scroll_depth`、`button_click`）、低侵入式按鈕埋點介面、全站業務事件清單，以及個資（PII）安全紅線。

---

## 1. 架構總覽 (Architecture Overview)

| 模組路徑                               | 職責說明                                                                                                                                                                                                                                                                                                             |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`                   | 當設定有效之 `NEXT_PUBLIC_GA_ID`（格式 `G-XXXXXXXXXX`）時，於 `<head>` 同步初始化輕量 `window.dataLayer` 與 `window.gtag` 佇列並設定 `{ send_page_view: false }`，再透過 Next.js `<Script strategy="afterInteractive" />` 非阻塞載入 `gtag.js`，消除初次進站 `page_view` 的載入競態（race condition）。              |
| `src/lib/analytics.ts`                 | 統一埋點封裝核心（Deep Module，零 React/Next UI 依賴）。負責雙軌派發（GA4 `gtag` / `window.dataLayer` + Microsoft Clarity）、PII 自動過濾、URL 敏感參數清洗與個人頁標題去識別化。                                                                                                                                    |
| `src/components/PageViewTracker.tsx`   | 掛載於全域 `Providers` 之單例 Client Component，統一負責：<br>1. **初次進站與 SPA 換頁 `page_view`**（含 React Strict Mode 去重防護）<br>2. **單一 `scroll_depth` 滾動深度追蹤**（`requestAnimationFrame` 節流 + 每頁門檻去重 + 換頁重置）<br>3. **`[data-analytics-click]` 事件委派**（低侵入式按鈕／連結點擊追蹤） |
| `src/components/WebVitalsReporter.tsx` | 收集 Core Web Vitals（LCP、CLS、INP、FCP、TTFB）並僅發送至 GA4（`skipClarity: true`）。                                                                                                                                                                                                                              |

---

## 2. 隱私與個資安全規範 (Zero-PII Policy)

**嚴格禁止**將任何個人識別資訊（PII）或憑證傳送至 GA4、`window.dataLayer` 或 Microsoft Clarity：

1. **禁止傳送之欄位與內容**：
   - 電子郵件（`email`、`user_email` 或任何含 `@` 信箱格式字串）
   - 真實姓名／顯示名稱（`name`、`full_name`、`user_name`、`display_name`）
   - 認證憑證與驗證碼（`token`、`access_token`、`refresh_token`、`id_token`、OAuth `code` / `state`、JWT、Bearer Token、密碼 `password`）
   - 電話號碼與使用者自由輸入之私密對話文字（如預約提問內容、拒絕原因全文）
2. **內建自動防禦機制（`src/lib/analytics.ts`）**：
   - `sanitizeAnalyticsMetadata()`：自動剔除敏感 key，並攔截值內含 Email、JWT 或 Bearer Token 的欄位。
   - `sanitizeUrlForAnalytics()`：自動剝除 URL hash（`#...`）與敏感 Query Parameters（`token`、`code`、`state`、`email`、`password`、`name` 等），保留安全行銷或狀態參數（如 `utm_source`、`mentor-onboarding`）。
   - `resolveSafePageTitle()`：針對動態個人檔案路由 `/profile/[pageUserId]` 與 `/profile/[pageUserId]/edit`（其 HTML `<title>` 含導師／學員姓名），自動去識別化為固定字串 `'User Profile'` 與 `'Profile Edit'`，防止姓名外洩至 GA4 `page_title`。
   - 若需關聯平台實體，僅允許使用平台內部數字／不透明識別碼（且僅在業務分析必要時於獨立事件使用，基礎事件預設不帶使用者 ID）。

---

## 3. 核心基礎事件規範 (Foundation Events)

### 3.1 `page_view` — 頁面瀏覽（初次進站 + SPA 換頁）

- **觸發時機**：使用者首次載入任意頁面時觸發 1 次；透過 Next.js App Router 進行 Client-side SPA 路由切換（`pathname` 改變）時各觸發 1 次。
- **GA4 發送方式**：`gtag('event', 'page_view', params)`（無 `window.gtag` 時寫入 `window.dataLayer`）。
- **事件參數**：

| 參數名稱        | 型別     | 範例值                               | 說明                             |
| :-------------- | :------- | :----------------------------------- | :------------------------------- |
| `page_path`     | `string` | `'/'`, `'/mentor-pool'`              | 清洗敏感參數後的路徑             |
| `page_location` | `string` | `'https://xtalent.vercel.app/about'` | 清洗敏感參數與 hash 後的完整網址 |
| `page_title`    | `string` | `'關於 X-Talent'`, `'User Profile'`  | 頁面標題（個人頁自動遮罩姓名）   |

### 3.2 `scroll_depth` — 頁面滾動深度

- **設計原則**：採用**單一事件名稱 `scroll_depth`** 搭配數值參數 `percent_scrolled`（避免拆成多個碎片事件名稱，便於 BigQuery 漏斗與分位數聚合）。
- **門檻定義**：`SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 90]`。
- **節流與去重**：
  - 使用 `{ passive: true }` 滾動監聽搭配 `requestAnimationFrame` 節流，不阻塞主執行緒捲動幀率。
  - 若頁面無可捲動高度（`scrollHeight <= innerHeight`）則不觸發。
  - 單一動畫幀內若一次跨越多個門檻（例如快速捲動或錨點跳轉），僅發送當次新跨越之**最高門檻**單筆 `scroll_depth` 事件，並將較低門檻一併標記為已達成。
  - 同一路由下往回捲動再往下捲動不會重複觸發；SPA 切換至新 `pathname` 時自動重置門檻紀錄。
  - 設定 `skipClarity: true`（Clarity 原生已具備滾動熱力圖）。
- **事件參數**：

| 參數名稱           | 型別     | 範例值                       | 說明                     |
| :----------------- | :------- | :--------------------------- | :----------------------- |
| `percent_scrolled` | `number` | `25` \| `50` \| `75` \| `90` | 達成之垂直滾動百分比門檻 |
| `page_path`        | `string` | `'/'`                        | 觸發滾動當下之頁面路徑   |
| `feature`          | `string` | `'engagement'`               | 功能領域分類             |

### 3.3 `button_click` — 低侵入式按鈕／導覽點擊

提供**宣告式屬性委派**與**命令式函式**兩種精簡接入方式，預設無須將 Server Component 改為 `'use client'`，亦無須在共用 `<Button>` 塞入耦合狀態：

#### 方式 A：宣告式 HTML Data Attributes（優先推薦，零 JS 樣板碼）

於任意 `<Button>`、`<Link>` 或原生 `<button>` / `<a>` 加上 `data-analytics-click`：

```tsx
<Link
  href="/about"
  data-analytics-click="header_nav_about"
  data-analytics-location="header"
>
  關於 X-Talent
</Link>
```

- `PageViewTracker` 透過全域單一 `document` 點擊委派自動擷取最近的 `[data-analytics-click]` 元素。
- 若元素帶有 `disabled` 或 `aria-disabled="true"`，自動忽略不送出。
- 若元素本身或外層為 `<a href="...">`，自動清洗並帶入 `link_url`。

#### 方式 B：命令式 Helper（適用於複雜業務 Callback 內）

```ts
import { trackButtonClick } from '@/lib/analytics';

trackButtonClick({
  buttonId: 'mentor_filter_apply',
  location: 'mentor_pool_toolbar',
  feature: 'mentor_pool',
});
```

- **事件參數**：

| 參數名稱          | 型別            | 範例值                                  | 說明                                |
| :---------------- | :-------------- | :-------------------------------------- | :---------------------------------- |
| `button_id`       | `string`        | `'header_nav_about'`, `'header_signin'` | 穩定之 `snake_case` 按鈕識別碼      |
| `button_location` | `string` (選填) | `'header'`, `'hero'`, `'footer'`        | 按鈕所在區塊位置                    |
| `link_url`        | `string` (選填) | `'/about'`, `'/auth/signin'`            | 清洗敏感參數後的導向目標路徑        |
| `page_path`       | `string`        | `'/'`                                   | 點擊當下所在頁面路徑                |
| `feature`         | `string`        | `'navigation'` \| `'auth'` ...          | 功能領域分類（預設 `'navigation'`） |

---

## 4. 全站事件總表 (Complete Event Catalog)

### 4.1 基礎與全站導覽 (Foundation & Navigation)

| 事件名稱 (`event`)   | `feature`             | 關鍵參數 (`metadata`)                                   | 觸發位置與時機                                                                                                                                                                  |      Clarity 同步      |
| :------------------- | :-------------------- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------: |
| `page_view`          | —                     | `page_path`, `page_location`, `page_title`              | 初次進站與每次 SPA 路由切換（`PageViewTracker`）                                                                                                                                | 否（Clarity 自動追蹤） |
| `scroll_depth`       | `engagement`          | `percent_scrolled` (`25`/`50`/`75`/`90`), `page_path`   | 頁面垂直滾動跨越新門檻時（`PageViewTracker`）                                                                                                                                   |   否 (`skipClarity`)   |
| `button_click`       | `navigation` / `auth` | `button_id`, `button_location`, `link_url`, `page_path` | 點擊標註 `data-analytics-click` 之導覽／行動按鈕（如 `header_logo`、`header_nav_mentor_pool`、`header_nav_about`、`header_signup`、`header_signin`）或呼叫 `trackButtonClick()` |           是           |
| `homepage_cta_click` | —                     | `cta` (`hero`/`shared`/`closing`), `variant`, `label`   | 點擊首頁 Hero、角色段落或頁尾前導 CTA（`HomePageCtaButton`）                                                                                                                    |           是           |
| `feedback_open`      | —                     | —                                                       | 點擊桌機／行動版 Header「提供回饋」外部連結                                                                                                                                     |           是           |
| `ui_dialog_open`     | —                     | `dialog: 'share_profile'`                               | 開啟個人檔案分享彈窗（`ShareProfileDialog`）                                                                                                                                    |           是           |

### 4.2 認證與新手引導 (Auth & Onboarding)

| 事件名稱 (`event`)                                            | `feature`    | 關鍵參數 (`metadata`) | 觸發位置與時機                                                      | Clarity 同步 |
| :------------------------------------------------------------ | :----------- | :-------------------- | :------------------------------------------------------------------ | :----------: |
| `sign_up_started`                                             | `auth`       | —                     | 進入註冊表單頁面掛載時（`useSignUpForm`）                           |      是      |
| `sign_up_succeeded`                                           | `auth`       | —                     | 註冊 API 成功送出後（`useSignUpForm`）                              |      是      |
| `sign_in_succeeded`                                           | `auth`       | —                     | 帳號密碼登入並取得有效 Session 後（`useSignInForm`）                |      是      |
| `delete_account_succeeded`                                    | `auth`       | —                     | 帳號刪除成功後（`useDeleteAccountForm` / `useGoogleOAuthCallback`） |      是      |
| `onboarding_step_viewed`                                      | `onboarding` | `step` (`1`–`5`)      | 檢視 Onboarding 各步驟畫面時（`useOnboardingForm`）                 |      是      |
| `onboarding_step_1_completed` ~ `onboarding_step_4_completed` | `onboarding` | —                     | 完成 Onboarding 第 1 至第 4 步提交時（`useOnboardingForm`）         |      是      |
| `onboarding_completed`                                        | `onboarding` | —                     | 完成 Onboarding 第 5 步並成功建立個人檔案後（`useOnboardingForm`）  |      是      |

### 4.3 導師探索、個人檔案與預約流程 (Mentor Pool, Profile & Reservation)

| 事件名稱 (`event`)                    | `feature`     | 關鍵參數 (`metadata`)   | 觸發位置與時機                                                                                | Clarity 同步 |
| :------------------------------------ | :------------ | :---------------------- | :-------------------------------------------------------------------------------------------- | :----------: |
| `mentor_pool_clear_all_filters_click` | —             | —                       | 於導師列表點擊「清除所有篩選條件」（`useMentorPoolFilters`）                                  |      是      |
| `profile_update_submitted`            | `profile`     | —                       | 儲存個人檔案或完成導師身分設定送出成功時（`saveProfile`）                                     |      是      |
| `reservation_booking_confirmed`       | `reservation` | —                       | Mentee 送出預約申請成功時（`useBookingConfirmation`）                                         |      是      |
| `reservation_accepted`                | `reservation` | `has_reply` (`boolean`) | Mentor 於快速回覆彈窗接受預約時（`QuickReplyDialog`，僅記錄是否有附言布林值，不傳送文字內容） |      是      |
| `reservation_rejected`                | `reservation` | —                       | Mentor 拒絕或雙方取消預約成功時（`useReservationActions`）                                    |      是      |
| `reservation_history_loaded`          | `reservation` | —                       | 切換載入歷史預約列表時（`useReservationData`）                                                |      是      |
| `reservation_load_more`               | `reservation` | —                       | 於預約列表點擊載入更多分頁時（`useReservationData`）                                          |      是      |

### 4.4 前端效能指標 (Core Web Vitals)

| 事件名稱 (`event`)          | `feature`     | 關鍵參數 (`metadata`) | 觸發位置與時機                         |    Clarity 同步    |
| :-------------------------- | :------------ | :-------------------- | :------------------------------------- | :----------------: |
| `performance_lcp_measured`  | `performance` | `raw_value`, `rating` | Next.js `useReportWebVitals` 回報 LCP  | 否 (`skipClarity`) |
| `performance_cls_measured`  | `performance` | `raw_value`, `rating` | Next.js `useReportWebVitals` 回報 CLS  | 否 (`skipClarity`) |
| `performance_inp_measured`  | `performance` | `raw_value`, `rating` | Next.js `useReportWebVitals` 回報 INP  | 否 (`skipClarity`) |
| `performance_fcp_measured`  | `performance` | `raw_value`, `rating` | Next.js `useReportWebVitals` 回報 FCP  | 否 (`skipClarity`) |
| `performance_ttfb_measured` | `performance` | `raw_value`, `rating` | Next.js `useReportWebVitals` 回報 TTFB | 否 (`skipClarity`) |

---

## 5. 命名慣例與驗證方式 (Naming & Verification)

1. **命名規則**：
   - 事件名稱與自訂參數一律採用 `snake_case`，長度不超過 40 字元（對齊 GA4 與 BigQuery 匯出欄位規範）。
   - 新增業務事件時，請同步更新本文件第 4 節事件總表。
2. **本地與自動化測試驗證**：
   - **開發環境 Console 與 `dataLayer`**：未設定 `NEXT_PUBLIC_GA_ID` 時不會載入外部 `gtag.js`，但所有事件皆會寫入瀏覽器 `window.dataLayer` 並在 `NODE_ENV=development` 印出 `[analytics]` 除錯紀錄。
   - **單元測試**：見 `src/lib/analytics.test.ts` 與 `src/components/PageViewTracker.test.tsx`。
   - **Playwright E2E**：見 `e2e/tests/public/ga4-analytics.spec.ts`，自動化驗證初次進站 `page_view`、SPA 換頁 `page_view`、滾動單一 `scroll_depth`（含 `percent_scrolled`）與 URL/Payload 無個資防護。
