# X-Talent Frontend 數據埋點規範與事件總表 (`docs/analytics-events.md`)

本文件為 `X-Talent-Frontend` 前端行為追蹤（Google Analytics 4 與 Microsoft Clarity）之單一規格參考，涵蓋架構設計、基礎事件（`page_view`、`scroll_depth`、`button_click`）、宣告式低侵入按鈕與業務漏斗埋點介面、全站業務事件對照表，以及個資（Zero-PII）安全紅線。

---

## 1. 架構與載入機制

1. **消除初次進站競態與 Inline Script 風險（`Ga4Bootstrap` Client 模組 + `afterInteractive` 外部腳本）**
   - `src/app/layout.tsx` 透過 `isValidGaMeasurementId` 驗證 `NEXT_PUBLIC_GA_ID`（僅接受 `/^G-[A-Z0-9]+$/i`），並由專屬 Client 元件 `src/components/Ga4Bootstrap.tsx` 於 `useInsertionEffect` 階段呼叫 `initGa4(gaId)` 初始化型別安全的 `window.dataLayer` 與 `window.gtag` 佇列（零 `dangerouslySetInnerHTML` 與零字串拼接，徹底杜絕 XSS / CodeQL 注入風險），同時執行 `gtag('config', gaId, { send_page_view: false, page_location, page_title })` 關閉 GA4 預設自動頁面瀏覽。
   - 外部 `https://www.googletagmanager.com/gtag/js` 透過 Next.js `<Script strategy="afterInteractive" />` 非阻塞載入；在腳本下載完成前，所有由 `PageViewTracker` 或業務元件觸發的事件皆會安全寫入 `window.dataLayer`，腳本就緒後由 `gtag.js` 自動沖刷送出，確保初次進站 `page_view` 100% 記錄且不重複。
2. **全域追蹤元件（`src/components/PageViewTracker.tsx`）**
   - **初次進站與 SPA 換頁 `page_view`（`usePageViewTracking`）**：監聽 `usePathname()` 與 NextAuth `useSession().status`；客戶端初次掛載期間若 `status === 'loading'` 會暫緩送出首筆 `page_view`（具備 1.5 秒逾時保護，避免 `/api/auth/session` 異常阻塞埋點），待工作階段解析完成且 `AnalyticsUserSync` 寫入 `user_id`／`user_role` 後再發送，確保已登入會員重整或進站首筆 `page_view` 即正確附帶 `user_id` 與 `user_role`。同時對 React Strict Mode 同路徑重複執行去重，並於停留 `/profile/[id]` 期間透過 `MutationObserver` 追蹤非同步串流更新之 `<title>`，離開個人頁時自動攔截殘留的真實姓名標題。
   - **單一事件分段滾動深度 `scroll_depth`（`useScrollDepthTracking`）**：採用 `window.requestAnimationFrame` 節流與 `{ passive: true }` 監聽器，統一以單一事件名稱 `scroll_depth` 搭配數值參數 `percent_scrolled`（`25`、`50`、`75`、`100`）依序發送該次滾動新跨越的所有門檻；達 `100%` 全數門檻後自動解除當前頁面的 `scroll` 監聽器以節省長列表效能，並於 SPA 換頁時重置門檻。
   - **宣告式低侵入點擊委派 `[data-analytics-click]`（`useAnalyticsClickDelegation`）**：透過單一全域 `document` Capture-phase 被動點擊委派監聽器，自動擷取含 `data-analytics-click`（以及選填 `data-analytics-event`、`data-analytics-location`、`data-analytics-feature`、`data-analytics-omit-destination`、`data-analytics-param-*`）的元素，連 Radix `DropdownMenu` / `Sheet` / `Popover` 關閉卸載前也能穩定攔截。
3. **NextAuth 會員身分與角色同步（`src/components/AnalyticsUserSync.tsx` + `Providers.tsx`）**
   - `Providers.tsx` 於 `<SessionProvider>` 內、`<PageViewTracker />` 之前掛載 `AnalyticsUserSync`，監聽 NextAuth `useSession()`。
   - **登入狀態（`mentee` / `mentor`）**：僅讀取內部 `session.user.id` 與布林值 `session.user.isMentor`，透過 `sanitizeAnalyticsUserId` 驗證後執行 `gtag('config', gaId, { send_page_view: false, user_id, user_role })`，並自動將 `user_id` 與 `user_role`（`'mentee'` \| `'mentor'`）附帶於後續所有 GA4 事件，支援跨裝置與跨工作階段漏斗歸因。
   - **訪客與登出清除（`guest`）**：未登入訪客設定 `user_role: 'guest'`（不附帶 `user_id`）；會員執行登出（`useAccountMenu`、`SessionErrorWatcher`、帳號刪除登出）或 Session 失效轉為 `unauthenticated` 時，立即發送 `gtag('config', gaId, { send_page_view: false, user_id: null, user_role: 'guest' })` 將 GA4 `user_id` 設為 `null` 清除，防止共用裝置後續瀏覽誤歸因至前一位會員。
4. **雙重分析後端同步與全域欄位防護（`src/lib/analytics.ts`）**
   - `dispatchGa4Event` 於每次送出事件時自動帶入經清洗之 `page_location`、`page_title`，以及當前工作階段之 `user_id`（僅已登入會員）與 `user_role`（`'mentee'` \| `'mentor'` \| `'guest'`），防止 `gtag.js` 背景回退讀取含敏感 Token、`?q=` 關鍵字或真實姓名之原始 DOM 狀態。
   - `trackEvent` 清洗參數後同步送往 GA4 與 Microsoft Clarity（透過 `setAnalyticsTag` 安全寫入已去識別化的 Session Replay 篩選標籤；高頻事件如 `scroll_depth` 與 Web Vitals 則透過 `{ skipClarity: true }` 略過 Clarity）。

---

## 2. 低侵入式埋點接入方式

### 方式 A：宣告式 HTML Data Attributes（優先推薦，零函式引入、支援 Server & Client Component）

一般導覽按鈕（預設送出 `button_click`）：

```tsx
<Link
  href="/mentor-pool"
  data-analytics-click="header_nav_mentor_pool"
  data-analytics-location="header"
  data-analytics-feature="navigation"
>
  尋找導師
</Link>
```

帶結構化業務參數之漏斗互動（使用 `data-analytics-event` 與 `data-analytics-param-*`）：

```tsx
<Link
  href={`/profile/${id}`}
  data-analytics-click="mentor_card"
  data-analytics-event="mentor_card_click"
  data-analytics-feature="mentor_pool"
  data-analytics-location="mentor_pool_list"
  data-analytics-param-mentor-id={String(id)}
>
  ...
</Link>
```

- 元素本身或其內外層互動容器處於 `disabled` / `aria-disabled="true"` 時自動忽略，不送出事件。
- 若外連網址可能包含個人帳號識別碼（例如個人頁 LinkedIn / GitHub URL），加上 `data-analytics-omit-destination="true"` 即可省略 `link_url`，僅保留安全的 `platform` 與數值 `mentor_id`。

### 方式 B：程式化 Helper（適用於表單送出成功、API 回呼或複雜業務狀態）

```ts
import { trackButtonClick, trackEvent } from '@/lib/analytics';

trackButtonClick({
  buttonId: 'hero_explore_mentors',
  location: 'landing_hero',
  destination: '/mentor-pool',
  feature: 'navigation',
});

trackEvent({
  name: 'reservation_booking_confirmed',
  feature: 'reservation',
  metadata: { role: 'mentee' },
});
```

---

## 3. 個資安全（Zero-PII）強制防線

`src/lib/analytics.ts` 於資料離開應用層前強制執行以下清洗規則：

1. **禁止傳遞之個資欄位（Key 攔截）**：自動剔除 `email`、`user_email`、`name`、`user_name`、`full_name`、`display_name`、`password`、`*token*`、`secret`、`code`、`state`、`phone`、`mobile`、`tel` 以及自由輸入搜尋字詞 `q`、`query`、`search`、`search_pattern`、`keyword` 等敏感鍵名。
2. **敏感數值特徵攔截（Value 攔截）**：任何字串值（含多重 URL 解碼後）若符合 Email 格式、JWT（`eyJ...`）、`Bearer <token>` 或非允許協定（`javascript:`、`data:`、`vbscript:`、`mailto:`、`tel:`、`sms:`），該欄位即被自動丟棄。
3. **嚴格 URL 協定白名單、路徑個資遮罩與巢狀 Redirect 遞迴清洗（`sanitizeUrlForAnalytics`）**：
   - 嚴格白名單僅允許單一 `/` 開頭之站內相對路徑（拒絕雙斜線 `//` 與含反斜線之路徑）以及 `http:` / `https:` 網址；全面阻擋 `javascript:`、`data:`、`vbscript:`、`mailto:`、`tel:` 等非 HTTP 協定。
   - 路徑區段解碼後若含 Email 或憑證特徵，強制退回安全根路徑 `/`。
   - 自動移除 Hash Fragment（`#...`）、敏感 Query 參數與自由搜尋字串 `?q=`，並對 `callbackUrl` 等巢狀跳轉網址（含雙重編碼）進行最多 3 層遞迴清洗，超過層數上限採 Fail-closed 丟棄（例如 `/auth/signin?callbackUrl=%2Fauth%2Femail-verify%3Ftoken%3Dxxx%26source%3Dbanner` 自動淨化內部 `token` 並保留 `source=banner`）。
4. **動態個人頁標題去識別化（`resolveSafePageTitle` + SPA 殘留標題防護）**：
   - `/profile/[userId]` 統一覆寫 `page_title` 為 `'User Profile'`；`/profile/[userId]/edit` 統一覆寫為 `'Profile Edit'`（靜態路由 `/profile/card` 保留原標題）。
   - 當使用者從 `/profile/[userId]` 透過 SPA 切換至其他頁面且 `document.title` 尚未刷新時，`PageViewTracker`（含非同步 `<title>` `MutationObserver`）與 `resolveSafePageTitle` 雙重攔截殘留姓名標題，確保真實姓名絕不外洩至 GA4。
5. **內部 User-ID 嚴格格式白名單（`sanitizeAnalyticsUserId`）**：
   - `user_id` 僅接受平台內部純識別碼（`/^[A-Za-z0-9_-]{1,64}$/`，生產環境為純數值字串如 `'7482008160728084'`），嚴禁傳遞 Email、真實姓名（含空白或非 ASCII 字元）、JWT（`eyJ...`）或任何 `accessToken` / `refreshToken`；不符合白名單之值一律轉為 `null` 丟棄。

---

## 4. 基礎與全站導覽埋點事件總表

### 4.1 基礎瀏覽與互動事件

| 事件名稱 (`event`) | `feature`                                                        | 觸發時機與位置                                                                        | 關鍵參數 (`params`)                                             | 個資防護說明                                            |
| :----------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :-------------------------------------------------------------- | :------------------------------------------------------ |
| `page_view`        | — (GA4 標準)                                                     | 初次進站掛載、SPA 路由切換（`PageViewTracker`）                                       | `page_path`, `page_location`, `page_title`                      | URL 遞迴清洗憑證與 `?q=`；個人頁與 SPA 殘留標題去識別化 |
| `scroll_depth`     | `engagement`                                                     | 頁面垂直滾動跨越 25% / 50% / 75% / 100%（單一事件、依序補齊新門檻、達 100% 自動解綁） | `percent_scrolled` (`25` \| `50` \| `75` \| `100`), `page_path` | 僅含數值百分比與清洗後路徑；`skipClarity: true`         |
| `button_click`     | `navigation` / `auth` / `onboarding` / `profile` / `reservation` | 點擊含 `data-analytics-click`（未覆寫 `data-analytics-event`）之導覽或 CTA            | `button_id`, `button_location`, `link_url` (選填), `page_path`  | `link_url` 僅允許 HTTP(S) 與站內路徑並自動遞迴清洗      |

### 4.2 全站 Header / 行動版漢堡選單 / 會員選單 (`button_id` 對照)

| `button_id`                                                              | 觸發元件與位置 (`button_location`)         | `feature`     | 對應動作                                        |
| :----------------------------------------------------------------------- | :----------------------------------------- | :------------ | :---------------------------------------------- |
| `header_logo`                                                            | `Header.tsx` (`header`)                    | `navigation`  | 點擊左上角品牌 Logo 回到首頁                    |
| `header_nav_mentor_pool`                                                 | `Header.tsx` (`header`)                    | `navigation`  | 桌機導覽列點擊「尋找導師」                      |
| `header_nav_become_mentor`                                               | `Header.tsx` (`header`)                    | `onboarding`  | 桌機導覽列（訪客／學員）點擊「成為導師」        |
| `header_nav_my_mentor_page`                                              | `Header.tsx` (`header`)                    | `navigation`  | 桌機導覽列（導師）點擊「我的導師頁面」          |
| `header_nav_about`                                                       | `Header.tsx` (`header`)                    | `navigation`  | 桌機導覽列點擊「關於 X-Talent」                 |
| `header_signup` / `header_signin`                                        | `GuestActionButtons.tsx` (`header`)        | `auth`        | 桌機訪客點擊「註冊」／「登入」                  |
| `mobile_menu_open`                                                       | `HamburgerMenu.tsx` (`mobile_menu`)        | `navigation`  | 行動版訪客開啟漢堡導覽選單                      |
| `mobile_nav_mentor_pool`                                                 | `HamburgerMenu.tsx` / `MobileUserMenu.tsx` | `navigation`  | 行動版選單點擊「尋找導師」                      |
| `mobile_nav_become_mentor`                                               | `HamburgerMenu.tsx` (`mobile_menu`)        | `onboarding`  | 行動版訪客選單點擊「成為導師」                  |
| `mobile_nav_about`                                                       | `HamburgerMenu.tsx` / `MobileUserMenu.tsx` | `navigation`  | 行動版選單點擊「關於 X-Talent」                 |
| `mobile_signin` / `mobile_signup`                                        | `HamburgerMenu.tsx` (`mobile_menu`)        | `auth`        | 行動版訪客點擊「登入」／「註冊」                |
| `user_menu_profile` / `mobile_user_menu_profile`                         | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `navigation`  | 已登入會員點擊進入個人頁面（不傳姓名與 userId） |
| `user_menu_share_profile` / `mobile_user_menu_share_profile`             | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `profile`     | 已登入會員點擊「分享個人頁面」                  |
| `user_menu_mentor_reservations` / `mobile_user_menu_mentor_reservations` | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `reservation` | 導師點擊「導師預約管理」                        |
| `user_menu_become_mentor` / `mobile_user_menu_become_mentor`             | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `onboarding`  | 學員點擊「成為導師」                            |
| `user_menu_my_reservations` / `mobile_user_menu_my_reservations`         | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `reservation` | 已登入會員點擊「我的預約」                      |
| `user_menu_my_favorites` / `mobile_user_menu_my_favorites`               | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `profile`     | 已登入會員點擊「我的收藏」進入 `/favorites`     |
| `user_menu_logout` / `mobile_user_menu_logout`                           | `UserDropdown.tsx` / `MobileUserMenu.tsx`  | `auth`        | 已登入會員點擊「登出」                          |

---

## 5. 核心業務漏斗事件總表

### 5.1 首頁、探索導師池與我的收藏 (`mentor_pool`)

| 事件名稱 (`event`)                                 | `feature`                    | 觸發位置                                                                                         | 關鍵參數                                                                                                                                                  | 說明                                                                                                                     |
| :------------------------------------------------- | :--------------------------- | :----------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `landing_cta_click`                                | `navigation`                 | `HomePageCtaButton.tsx`                                                                          | `cta`, `role`, `destination`                                                                                                                              | 首頁 Hero、角色切換與頁尾轉換按鈕點擊                                                                                    |
| `mentor_pool_filter_apply`                         | `mentor_pool`                | `PopularPositionChips.tsx` (`popular_positions`), `MentorFilterDropdown.tsx` (`filter_dropdown`) | `filter_type` (`popular_position` \| `filter_skills` \| `filter_topics` \| `filter_industries` \| `none`), `filter_value`, `button_id`, `button_location` | 點擊熱門職位快篩標籤或篩選下拉選單「套用」（僅傳受控目錄代碼或公開熱門職稱，絕不傳自由搜尋關鍵字）                       |
| `mentor_pool_filter_remove`                        | `mentor_pool`                | `src/app/mentor-pool/ui.tsx` (`active_filter_badges`)                                            | `filter_type`, `filter_value`, `button_id`, `button_location`                                                                                             | 點擊已選篩選條件膠囊之移除按鈕                                                                                           |
| `mentor_pool_clear_all_filters_click`              | —                            | `useMentorPoolFilters.ts`                                                                        | —                                                                                                                                                         | 空狀態點擊「清除所有條件」重置篩選                                                                                       |
| `mentor_card_click`                                | `mentor_pool`                | `src/components/mentor-pool/mentor-card/index.tsx` (`mentor_pool_list` / `favorites_list`)       | `mentor_id` (純數值字串), `link_url` (`/profile/[id]`), `button_id`, `button_location`                                                                    | 於導師池或「我的收藏」列表點擊導師卡片進入導師個人頁（嚴禁傳遞導師姓名）                                                 |
| `mentor_bookmark_toggle`                           | `mentor_pool` / `profile`    | `MentorBookmarkButton.tsx` (`useFavoriteMentor.ts`), `useConsumePendingFavorite.ts`              | `mentor_id` (純數值 ID), `action` (`'add'` \| `'remove'`), `button_location` (`'mentor_pool_list'` \| `'profile_header'` \| `'favorites_list'`)           | 已登入會員於導師池卡片、導師個人頁或我的收藏切換書籤（含未登入攔截登入後自動完成收藏），嚴禁夾帶導師姓名或使用者識別資訊 |
| `button_click` (`favorites_empty_explore_mentors`) | `navigation` / `mentor_pool` | `/favorites` 空狀態 CTA (`favorites_empty_state`)                                                | `button_id`, `button_location`, `link_url` (`'/mentor-pool'`), `page_path`                                                                                | 「我的收藏」空狀態點擊「尋找導師」CTA 前往導師池探索                                                                     |

### 5.2 導師個人頁與檔案管理 (`profile` / `onboarding`)

| 事件名稱 (`event`)                                                              | `feature`                | 觸發位置                                                                                       | 關鍵參數                                                                                          | 說明                                                                                                       |
| :------------------------------------------------------------------------------ | :----------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| `mentor_bookmark_toggle`                                                        | `profile`                | `src/app/profile/[pageUserId]/ui.tsx` (`MentorBookmarkButton`), `useConsumePendingFavorite.ts` | `mentor_id` (純數值 ID), `action` (`'add'` \| `'remove'`), `button_location` (`'profile_header'`) | 導師個人頁點擊收藏／取消收藏書籤，或訪客點擊書籤登入返回個人頁自動完成收藏（嚴禁夾帶導師姓名或任何 PII）   |
| `profile_tab_click`                                                             | `profile`                | `src/app/profile/[pageUserId]/ui.tsx` (`profile_tabs`)                                         | `tab_name` (`about` \| `feedback`), `mentor_id`, `button_id`                                      | 切換導師個人頁「簡介」與「評價」分頁                                                                       |
| `profile_social_link_click`                                                     | `profile`                | `src/app/profile/[pageUserId]/ui.tsx` (`profile_header`)                                       | `platform` (`linkedin` \| `github` \| `website` 等), `mentor_id`, `button_id`                     | 點擊導師個人頁外部社群連結（設 `data-analytics-omit-destination="true"` 不送出含個人帳號 slug 之外部網址） |
| `button_click` (`profile_edit_click` / `profile_become_mentor_click`)           | `profile` / `onboarding` | `src/app/profile/[pageUserId]/ui.tsx` (`profile_header`)                                       | `button_id`, `button_location`, `page_path`                                                       | 本人檢視個人頁點擊「編輯個人資訊」或「成為導師」                                                           |
| `button_click` (`profile_booking_slot_select` / `profile_booking_submit_click`) | `reservation`            | `MenteeBookingForm.tsx` (`profile_booking_card`)                                               | `mentor_id`, `button_id`, `button_location`, `page_path`                                          | 學員於導師個人頁點選可預約時段、點擊「預約時間」送出按鈕（攜帶 `mentor_id`，不記錄提問內容）               |
| `profile_saved`                                                                 | `profile`                | `saveProfile.ts`                                                                               | `is_mentor`                                                                                       | 個人檔案編輯儲存成功                                                                                       |
| `share_profile_link_copied`                                                     | `profile`                | `ShareProfileDialog.tsx`                                                                       | —                                                                                                 | 複製個人檔案分享連結                                                                                       |

> **註（導師收藏隱私與零通知不變量）**：`mentor_bookmark_toggle` 已正式上線，僅在已確認會員身分實際發起收藏切換（或未登入攔截完成登入後自動寫入收藏）時送出，參數嚴格限制為純數值 `mentor_id`、`action`（`'add'` \| `'remove'`）與受控位置 `button_location`（`'mentor_pool_list'` \| `'profile_header'` \| `'favorites_list'`），絕不夾帶導師姓名、會員姓名或 Email；且收藏行為純屬私人書籤，不觸發任何站內通知、新時段通知或外部 Email。

### 5.3 認證與註冊引導 (`auth` / `onboarding`)

| 事件名稱 (`event`)                                     | `feature`    | 觸發位置                                                   | 關鍵參數                                                                      | 說明                                                           |
| :----------------------------------------------------- | :----------- | :--------------------------------------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------- |
| `sign_up_started`                                      | `auth`       | `useSignUpForm.ts`                                         | `user_role` (`guest`)                                                         | 進入註冊表單頁啟動註冊流程（不記錄 Email）                     |
| `sign_up`                                              | `auth`       | `useSignUpForm.ts`, `useGoogleOAuthCallback.ts` (`SIGNUP`) | `method` (`Email` \| `Google`), `user_role` (`guest`)                         | GA4 標準註冊完成事件（統一收斂 Email 與 Google OAuth 註冊）    |
| `login`                                                | `auth`       | `useSignInForm.ts`, `useGoogleOAuthCallback.ts` (`LOGIN`)  | `method` (`Email` \| `Google`), `user_role` (`mentee` \| `mentor`), `user_id` | GA4 標準登入成功事件（同步綁定內部 `user_id`，嚴禁記錄 Email） |
| `delete_account_succeeded`                             | `auth`       | `useDeleteAccountForm.ts`, `useGoogleOAuthCallback.ts`     | —                                                                             | 帳號刪除完成（隨後立即呼叫 `clearAnalyticsUser()` 清除 ID）    |
| `onboarding_step_0_completed` ~ `onboarding_completed` | `onboarding` | `useOnboardingForm.ts`                                     | `role` (部分步驟)                                                             | 新手引導各步驟完成與最終完賽                                   |

### 5.4 預約流程、Google Meet 進入與系統監控 (`reservation` / `feedback` / `performance`)

| 事件名稱 (`event`)                                                        | `feature`     | 觸發位置                                                                                 | 關鍵參數                                                                                                                    | 說明                                                                        |
| :------------------------------------------------------------------------ | :------------ | :--------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `reservation_signin_prompt_click`                                         | `reservation` | `MenteeBookingForm.tsx`                                                                  | `mentor_id` (選填)                                                                                                          | 未登入訪客於導師頁點擊「前往登入」以進行預約                                |
| `reservation_booking_confirmed`                                           | `reservation` | `useBookingConfirmation.ts`                                                              | —                                                                                                                           | 學員送出預約申請成功（不含提問內容）                                        |
| `reservation_join_meet_click`                                             | `reservation` | `JoinMeetButton.tsx`（`ReservationCard` 與 `ConfirmedReservationDialog` 共用）           | `source_role` (`mentor` \| `mentee`), `button_location` (`reservation_card` \| `confirmed_reservation_dialog`), `button_id` | 點擊「加入 Google Meet」按鈕（嚴禁傳遞 Google Meet 會議室代碼或參與者姓名） |
| `reservation_tab_changed` / `reservation_load_more`                       | `reservation` | `useReservationData.ts`                                                                  | `role`, `tab`                                                                                                               | 預約管理頁籤切換與載入更多                                                  |
| `reservation_accepted` / `reservation_rejected` / `reservation_cancelled` | `reservation` | `AcceptReservationDialog.tsx`, `useReservationActions.ts`, `CancelReservationDialog.tsx` | `role` (選填)                                                                                                               | 導師接受／婉拒預約、任一方取消預約                                          |
| `reservation_schedule_saved` / `reservation_quick_reply_sent`             | `reservation` | `MentorScheduleDialog.tsx`, `QuickReplyDialog.tsx`                                       | `slot_count` (排程)                                                                                                         | 導師儲存可預約時段、送出快速回覆                                            |
| `reservation_profile_viewed` / `reservation_history_conversation_opened`  | `reservation` | `ReservationList.tsx`, `ReservationMessagePreview.tsx`                                   | `source_role`                                                                                                               | 從預約卡片檢視對方檔案或開啟對話紀錄                                        |
| `feedback_open`                                                           | `feedback`    | `Header.tsx`, `HamburgerMenu.tsx`, `MobileUserMenu.tsx`                                  | —                                                                                                                           | 點擊外部「提供回饋」表單連結                                                |
| `performance_*_measured`                                                  | `performance` | `WebVitalsReporter.tsx`                                                                  | `raw_value`, `rating`, `navigation_type`                                                                                    | Core Web Vitals 效能指標（`skipClarity: true`）                             |

---

## 6. GA4 Custom Dimensions 與 User-ID 設定對照表

於 Google Analytics 4 後台（`Admin` → `Data display` → `Custom definitions` → `Custom dimensions` / `Custom metrics`）建立報表與探索漏斗時，請依下表註冊對應參數：

### 6.1 內建跨裝置身分識別（GA4 Built-in User-ID & Event Identity）

| 參數名稱 (`Parameter`) | GA4 後台機制 / 維度名稱 | 範圍 (`Scope`)            | 允許值 / 格式範例                            | 用途與個資防護規範                                                                                     |
| :--------------------- | :---------------------- | :------------------------ | :------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `user_id`              | Built-in `User-ID`      | Identity (`config`+Event) | 內部純數值字串（如 `'999998'`）／登出 `null` | 綁定 NextAuth `session.user.id` 支援跨裝置去重歸因；嚴禁傳遞 Email、姓名或 Token，登出時設 `null` 清除 |

### 6.2 自訂維度對照表（Custom Dimensions）

| 參數名稱 (`Event Parameter`) | 建議維度名稱 (`Dimension Name`) | 範圍 (`Scope`) | 允許值 / 範例                                                                                       | 對應事件與業務用途                                                                                    |
| :--------------------------- | :------------------------------ | :------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `user_role`                  | User Role                       | Event          | `'mentee'` \| `'mentor'` \| `'guest'`                                                               | 全站事件與 `config` 共通會員角色分群（學員／導師／未登入訪客）                                        |
| `method`                     | Auth Method                     | Event          | `'Google'` \| `'Email'`                                                                             | `login`、`sign_up` 認證管道歸因（GA4 標準預設支援參數）                                               |
| `feature`                    | Feature Domain                  | Event          | `'auth'` \| `'onboarding'` \| `'mentor_pool'` \| `'profile'` \| `'reservation'` 等 9 類             | 全站產品模組與業務功能分群                                                                            |
| `button_id`                  | Button ID                       | Event          | `'header_signin'`、`'mentor_card'`、`'user_menu_logout'`                                            | 宣告式 `[data-analytics-click]` 與 `trackButtonClick` 互動元件識別碼                                  |
| `button_location`            | Button Location                 | Event          | `'header'`、`'mobile_menu'`、`'mentor_pool_list'`、`'reservation_card'`                             | 按鈕所在頁面區塊或容器位置                                                                            |
| `link_url`                   | Sanitized Link URL              | Event          | `'/mentor-pool'`、`'https://...'`                                                                   | 導覽目標路徑／安全外連網址（已自動遞迴清洗敏感參數與個人社群帳號 URL）                                |
| `page_path`                  | Sanitized Page Path             | Event          | `'/'`、`'/mentor-pool?filter_skills=frontend'`                                                      | 事件發生當下經去識別化清洗之站內路徑（自動移除 `?q=` 與憑證參數）                                     |
| `mentor_id`                  | Mentor ID                       | Event          | 純數值或純數值字串（如 `'7482008160728084'`）                                                       | 導師卡片點擊、導師書籤收藏切換（`mentor_bookmark_toggle`）、個人頁分頁／社群點擊、預約流程目標導師 ID |
| `action`                     | Bookmark Action                 | Event          | `'add'` \| `'remove'`                                                                               | `mentor_bookmark_toggle` 導師收藏切換動作（新增收藏／取消收藏）                                       |
| `filter_type`                | Mentor Filter Type              | Event          | `'popular_position'` \| `'filter_skills'` \| `'filter_topics'` \| `'filter_industries'` \| `'none'` | 導師池篩選條件類型                                                                                    |
| `filter_value`               | Mentor Filter Value             | Event          | 受控目錄代碼或公開熱門職稱字串（絕不含自由輸入搜尋字詞）                                            | 導師池套用或移除之篩選項目值                                                                          |
| `tab_name`                   | Profile Tab Name                | Event          | `'about'` \| `'feedback'`                                                                           | 導師個人頁分頁切換目標                                                                                |
| `platform`                   | Social Platform                 | Event          | `'linkedin'` \| `'github'` \| `'website'` 等                                                        | 導師個人頁外部連結平台類型（不記錄外部帳號網址本身）                                                  |
| `cta`                        | Landing CTA ID                  | Event          | `'hero'`、`'footer'` 等                                                                             | 首頁轉換按鈕識別碼                                                                                    |
| `role`                       | Funnel Target Role              | Event          | `'mentee'` \| `'mentor'`                                                                            | 首頁 CTA、Onboarding、預約操作當下對應之業務角色視角                                                  |
| `source_role`                | Reservation Source Role         | Event          | `'mentee'` \| `'mentor'`                                                                            | `reservation_join_meet_click`、預約對話與檔案檢視之發起方角色                                         |
| `tab`                        | Reservation Status Tab          | Event          | `'PENDING'` \| `'ACCEPTED'` \| `'PAST'` 等                                                          | 預約管理列表頁籤狀態                                                                                  |
| `is_mentor`                  | Is Mentor Profile               | Event          | `'true'` \| `'false'`（布林轉字串維度）                                                             | `profile_saved` 儲存個人檔案時是否具備導師身分                                                        |
| `rating`                     | Web Vital Rating                | Event          | `'good'` \| `'needs-improvement'` \| `'poor'`                                                       | Core Web Vitals 效能分級                                                                              |
| `navigation_type`            | Navigation Type                 | Event          | `'navigate'` \| `'reload'` \| `'back-forward'`                                                      | Core Web Vitals 瀏覽導覽型態                                                                          |

### 6.3 自訂指標對照表（Custom Metrics，選用）

| 參數名稱 (`Event Parameter`) | 建議指標名稱 (`Metric Name`) | 範圍 (`Scope`) | 測量單位 (`Unit`)       | 對應事件與說明                                            |
| :--------------------------- | :--------------------------- | :------------- | :---------------------- | :-------------------------------------------------------- |
| `percent_scrolled`           | Percent Scrolled             | Event          | Standard                | `scroll_depth` 分段滾動百分比（`25`、`50`、`75`、`100`）  |
| `slot_count`                 | Schedule Slot Count          | Event          | Standard                | `reservation_schedule_saved` 導師單次儲存之可預約時段數量 |
| `raw_value`                  | Web Vital Raw Value          | Event          | Milliseconds / Standard | `performance_*_measured` Core Web Vitals 原始量測數值     |

---

## 7. 驗證與回歸測試方式

1. **瀏覽器本地驗證**：開啟 DevTools Console 檢視 `window.dataLayer`，或在 GA4 DebugView 觀察會員登入後 `config` 與各事件攜帶內部 `user_id` 與 `user_role`、`login` / `sign_up` 攜帶 `method`（`Google` \| `Email`），以及點擊「登出」後 `user_id: null` 與 `user_role: 'guest'` 清除紀錄。
2. **自動化測試覆蓋**：
   - **單元測試**：見 `src/app/layout.test.tsx`、`src/lib/analytics.test.ts`、`src/components/AnalyticsUserSync.test.tsx`、`src/components/PageViewTracker.test.tsx`、`src/components/SessionErrorWatcher.test.tsx`、`src/hooks/auth/useSignInForm.test.ts`、`src/hooks/auth/useSignUpForm.test.ts`、`src/hooks/auth/useDeleteAccountForm.test.ts`、`src/app/auth/google/callback/redirect/container.test.tsx`、`src/hooks/layout/useAccountMenu.test.ts`、`src/components/layout/Header/Header.test.tsx`、`src/components/filter/MentorFilterDropdown.test.tsx`、`src/components/profile/reservation/BookingForm.test.tsx`、`src/components/reservation/JoinMeetButton.test.tsx`、`src/components/favorites/MentorBookmarkButton.test.tsx` 與 `src/hooks/favorites/useConsumePendingFavorite.test.tsx`。
   - **Playwright E2E**：見 `e2e/tests/public/ga4-analytics.spec.ts`、`e2e/tests/public/ga4-user-identity.spec.ts` 與 `e2e/tests/profile/favorites-analytics-and-sync.spec.ts`，自動化驗證初次進站與 SPA `page_view`、分段滾動 `scroll_depth`、導師池篩選／卡片埋點、導師收藏 `mentor_bookmark_toggle` 跨頁同步與鍵盤無障礙操作、會員登入 `user_id` / `user_role` 綁定與事件附帶、登出 `user_id: null` 清除、`login` / `sign_up`（`Google` \| `Email`）事件收斂，以及全程個資零外洩防線。
