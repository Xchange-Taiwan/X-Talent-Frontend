這份文件收錄「不會寫在單一 ticket 裡、但整個平台都要遵守」的業務規則（domain invariants）。目的是讓 Business Logic Reviewer 不需要靠 tribal knowledge，也能判斷一個 PR 是不是做了「技術上邏輯正確、但業務上根本不該存在」的事。

**維護方式**：只要 AI reviewer（或人類 reviewer）事後發現漏掉一個「因為不懂平台業務規則而犯的錯」，就把那條規則寫進來，避免同一類錯誤在下一個 PR 又發生一次。每條規則都要附上「為什麼」跟「reviewer 該怎麼做」，單純條列規則但沒有依據，之後很容易被誤用或誤判成過時。

---

## 角色與 Onboarding

- **Onboarding 流程（`src/app/auth/(sign)/onboarding/**`、`src/components/onboarding/**`）永遠只有 mentee 會走過。** 使用者在完成 onboarding 之前不可能是 mentor —— `session.user.isMentor` / DTO 的 `is_mentor` 在這個流程裡永遠是 `false`（`buildOnboardingDtoStub` 也是以此為前提，預設 `isMentor: false`）。
  - **因此**：onboarding 相關檔案裡任何依賴 `isMentor` / `is_mentor` 為 `true` 的分支，都是永遠不會執行的死路（unreachable code）。
  - **案例**：PR #641「mentor 需強制上傳頭像」在 `src/app/auth/(sign)/onboarding/container.tsx` 加了 `if (isMentor && !avatar)` 檢查，這段永遠不會觸發；正確的位置是 `/profile/[pageUserId]/edit`（該 PR 也確實同時改了 `profile/edit/container.tsx` 與 `profileSchema.ts`，onboarding 那份是多餘的實作）。
  - **Reviewer 該做的事**：只要看到 onboarding 相關檔案裡出現 mentor-only 分支、或新增邏輯依賴 `isMentor`/`is_mentor` 為真，一律回報為「業務邏輯不成立，應移除或搬到 profile edit 流程」。

- 角色專屬 UI 在角色 resolve 前不可 render（見 project context）是「時序」問題，跟上面「onboarding 裡沒有 mentor」是不同層次的規則——前者是「還不知道角色」，後者是「這個流程裡角色的答案永遠已知且固定」，兩者都要檢查，不要混為一談。

- **「onboarding」在這個專案裡其實是兩個語意完全不同的入口，不能只看名字判斷。**
  1. `/auth/(sign)/onboarding`（`src/app/auth/(sign)/onboarding/**`）—— 新用戶「註冊後」的初次填寫個人資料流程，就是上面那條規則講的、永遠是 mentee 的那個。
  2. `/profile/[pageUserId]/edit?onboarding=true` —— 既有使用者「成為導師」的流程。所有「成為導師」按鈕（Header、HamburgerMenu、UserDropdown、MobileUserMenu）都導到這裡；`isMentorOnboarding` 這個 query flag 會傳進 `useEditProfileData` / `useProfileSubmit`，讓既有的 profile edit 頁面切換成「導師專屬必填欄位」模式。沒有任何入口導到 `/auth/onboarding`。
  - **因此**：PR 描述或 ticket 只寫「onboarding」時不能假設是指哪一個，要看 diff 實際動到 `src/app/auth/(sign)/onboarding/**` 還是 `src/app/profile/[pageUserId]/edit/**` 才能判斷。
  - **案例**：PR #641「mentor 需強制上傳頭像」正確位置是入口 2（`/profile/edit`，該 PR 也確實這樣做了），但同一份 PR 把同樣的邏輯又加了一份到入口 1（`/auth/onboarding`）——很可能就是把這兩個「onboarding」搞混了，這正是本文件最上面那條規則的真正成因。
  - **Reviewer 該做的事**：如果同一個「只該屬於某一邊」的需求同時出現在兩個入口，視為 Misplaced Implementation。

---

## Mentor Profile 必填欄位

- **Mentor 的個人檔案（profile edit）比 mentee 多一組必填欄位，而且已經有唯一正確的實作位置。** 在 `createProfileFormSchema(isMentor)`（`src/components/profile/edit/profileSchema.ts`）裡，只有 `isMentor === true` 時才透過 `superRefine` 強制要求：`about`、`industry`、`have_topic`（至少 1 個）、`have_skill`（至少 1 個）、`work_experiences`（至少 1 筆）、`educations`（至少 1 筆）。這些欄位對 mentee 都是選填或有預設值。
  - **因此**：任何新的「mentor 才需要填 XXX」需求，正確做法是在這個 schema 裡加欄位或加 `superRefine` 分支，不該在 onboarding 或其他頁面另外刻一份驗證邏輯。
  - **Reviewer 該做的事**：diff 若在 `profileSchema.ts` 以外的檔案新增「只有 mentor 才需要」的表單驗證，視為 Misplaced Implementation，應指向這個 schema。反過來，若 mentee 被要求填上面這些 mentor-only 欄位，視為 Business Rule Violation。

---

## 刪除帳號

- **只有 3 個寫死的測試帳號能在 UI 上看到「刪除帳號」選項，這是刻意的權限限制，不是預設隱藏的一般 feature flag。** `canDeleteAccount` 寫死比對 3 個 email：`testing_visitor@xchange.com.tw`、`testing_mentee@xchange.com.tw`、`testing_mentor@xchange.com.tw`。這份清單在 `UserDropdown.tsx` 與 `MobileUserMenu.tsx` 各自維護一份**完全相同**的陣列，沒有共用常數。
  - **因此**：一般使用者帳號目前完全看不到刪除帳號入口；這份清單的存在本身就是業務規則，不是待清理的技術債。
  - **Reviewer 該做的事**：
    1. diff 改了這份允許清單（新增/移除 email、或改成對所有人開放）——視為業務規則變更，必須有對應 ticket／需求依據，不能是附帶改動。
    2. diff 只改了 `UserDropdown.tsx` 或 `MobileUserMenu.tsx` 其中一份清單、沒有同步改另一份——兩處會不一致（例如手機版能刪、桌面版不能刪），視為 Business Rule Violation，不是單純 code smell。

- **使用者有未完成或未來的預約時，刪除帳號會被擋下，且這個狀態必須獨立處理，不能併入一般錯誤訊息。** 呼叫刪除帳號 API 後，若後端回傳 `status === 'blocked_reservations'`，前端要顯示「您目前有未完成或未來的預約，請先處理後再刪除帳號」並附上前往預約管理的連結（`src/hooks/auth/useDeleteAccountForm.ts` 的 `blockedByReservations` state、`src/components/auth/DeleteAccountDialog.tsx` 對應 UI），不會走登出/刪除流程。
  - **因此**：這是獨立於「成功／一般失敗」的第三種結果，UI 必須給出可操作的下一步，不能被靜默吞掉或改成一般錯誤 toast。
  - **Reviewer 該做的事**：diff 修改刪除帳號的 submit 流程時，確認 `blocked_reservations` 分支還在、仍獨立於 success/一般 error 處理，訊息與導頁行為沒有被移除或跟一般錯誤訊息混在一起。

---

## 預約（Reservation）狀態與流程

- **只有導師能「接受／拒絕」一筆待回覆的預約請求；學員在同一個 pending 狀態下只有「取消」。** `ReservationList.tsx` 的 actions 是用 `variant === 'pending-mentor'` 分流：是就渲染 `RejectReservationDialog` + `AcceptReservationDialog`，其他情況（含 `pending-mentee`）一律渲染 `CancelReservationDialog`。學員永遠不會看到 Accept/Reject 按鈕。
  - **因此**：預約請求的決定權在導師手上，學員只能發起或撤回，不能片面「接受」自己發出的邀約。
  - **Reviewer 該做的事**：diff 若在 `pending-mentee` 或學員視角的元件裡加上 Accept/Reject 相關 UI 或呼叫，視為 Business Rule Violation；新增的操作應該走 Cancel 那一支。

- **拒絕與取消預約必須填寫原因才能送出，接受預約的回覆訊息是選填。** `RejectReservationDialog.tsx` 與 `CancelReservationDialog.tsx` 的 `canSubmit` 都要求 `reason.trim().length > 0`；`AcceptReservationDialog.tsx` 的 `handleAccept` 沒有這個限制，`reply` 留空一樣能送出。
  - **因此**：任何會讓對方預約落空的動作（拒絕、取消）都要求交代理由，這是對另一方的最低限度說明義務；接受則沒有這個負擔。
  - **Reviewer 該做的事**：diff 若把 Reject/Cancel 的必填原因改成選填，或反過來要求 Accept 必填回覆，先確認是不是刻意的產品決策，不能當作單純的表單體驗調整處理。

- **拒絕（Reject）與取消（Cancel）在 API 層是同一個操作，沒有獨立的 CANCEL 狀態。** `ReservationList.tsx` 的 `rejectOrCancel` 是共用函式，兩者都呼叫 `updateReservationStatus` 並帶 `my_status: 'REJECT'`，差別只在呼叫入口與成功訊息文案。
  - **因此**：不能假設後端有獨立的「取消」狀態可以查——不管是導師拒絕待審預約，還是任一方取消已成立的預約，都會被記錄成 REJECT。
  - **Reviewer 該做的事**：diff 若要新增「取消原因」和「拒絕原因」分開儲存/顯示的邏輯，要先確認後端 payload 是否真的能區分，不能假設兩者在資料層是分開的。

- **一筆預約若雙方都標記 REJECT，UI 上顯示的「取消者」以對方（participant）為準，不是以誰先送出為準。** 見 `src/components/reservation/types.ts:33-36` 的 `cancelledBy` 欄位註解："Participant (other side) takes precedence when both are REJECT."。
  - **因此**：這是刻意的優先權設計，不是誰先觸發誰就顯示——沒看過這條規則的人很容易假設是「先到先得」或「用當前登入者角度判斷」。
  - **Reviewer 該做的事**：diff 涉及 `cancelledBy` 的計算邏輯時，確認雙方都取消的 edge case 仍然是 participant 優先，不是被改成 sender 優先或看時間戳。

- **建立一筆新預約永遠是 `PENDING` 狀態，必須等導師 `ACCEPT` 後才會出現在雙方的「即將到來」列表。** 見 `MenteeReservationDialog.tsx` 的 `handleConfirm`（送出時固定 `my_status: 'PENDING'`）與 UI 文案「預約已送出，等待導師回復」「導師接受後預約才會成立」。
  - **因此**：學員選時段送出的當下不代表預約成立，任何「送出=成立」的實作假設都是錯的。
  - **Reviewer 該做的事**：diff 若讓建立預約後直接進 upcoming 列表、或跳過導師確認步驟，視為 Business Rule Violation。

- **導師已接受的時段，目前不會從其他學員的可預約清單中自動排除，這是已知的後端限制，不是遺漏的功能。** 見 `ReservationList.tsx:115-118` 與 `:166-167` 的 TODO 註解：後端 `PUT /mentors/:id/schedule` 在 BLOCK 時段與既有 ALLOW 時段重疊時會回 422，沒有真正阻擋已接受時段被其他人重複預約，前端目前只能靠 409/conflict 訊息事後攔一次同一使用者的重複請求。
  - **因此**：這不是「應該修但還沒修」的一般 bug，是已經記錄、卡在後端能力的已知缺口——reviewer 不該把它當成新發現的 bug 回報，也不該假設現有 409 conflict 檢查已經涵蓋了「時段被別人訂走」的情況。
  - **Reviewer 該做的事**：看到與此相關的 PR，先確認是否在解這個已知 TODO（後端已支援 block slot 或回傳 booked_slots），而不是重新發一個「重複預約沒擋掉」的 bug report；若 diff 聲稱解決了這個問題，要確認後端契約真的變了。

---

## 導師時段管理（Mentor Schedule）同步

- **儲存時段變更是 PUT（新增/更新）優先於 DELETE，PUT 失敗會整批中止、不會再送出 DELETE。** 見 `src/services/mentor-schedule/sync.ts` 的 `syncMonthSchedule` 與其上方註解："PUT failure aborts before DELETE so we don't partially mutate the schedule."
  - **因此**：這是刻意避免「新增失敗但刪除已經生效」造成的半套資料狀態，不是效能考量下可以隨意調整執行順序的地方。
  - **Reviewer 該做的事**：diff 若把 PUT/DELETE 改成平行送出（`Promise.all`）或反轉順序，視為 Business Rule Violation，除非同時說明如何避免部分失敗的資料不一致。

- **多個月份的時段變更是逐月循序送出，前面月份成功不會因為後面月份失敗而回滾。** 見 `syncMonths` 的註解："earlier success is NOT rolled back if a later month fails... Sequential (not parallel) avoids cache write races."
  - **因此**：每個月是獨立的儲存單位，UI 需要能個別呈現「哪幾個月成功、哪幾個月失敗」，不能假設整批操作是全有全無（all-or-nothing）的交易。
  - **Reviewer 該做的事**：diff 若把多月 sync 改成平行執行，或假設一個月失敗代表全部都要復原，視為 Business Rule Violation。

- **新增時段（尤其是「每週重複」批次新增）是原子性的：只要其中一個 occurrence 跟現有時段重疊，整批都會被拒絕，不會只新增沒有衝突的那幾筆。** 見 `useMentorSchedule.ts` 的 `addSlotForSelectedDate`，`hasAnyOccurrenceOverlap` 檢查失敗時直接 `return prev`（整批放棄），註解："This keeps weekly add atomic — we don't silently create a partial recurrence."
  - **因此**：使用者看到的「新增失敗」訊息代表這批時段一筆都沒有進到 draft，不會有部分成功的情況需要另外處理。
  - **Reviewer 該做的事**：diff 若讓批次新增變成「逐筆各自判斷是否衝突」，視為 Business Rule Violation，除非產品需求明確要改成部分新增。

---

## 註冊與帳號存取

- **Email/密碼註冊必須勾選同意服務條款才能送出（Zod schema 強制），但 Google OAuth 註冊入口完全沒有這個檢查。** 見 `src/schemas/auth.ts` 的 `hasReadTermsOfService: z.boolean().refine(...)` 只掛在 `SignUpSchema`（email/password 表單）；`src/app/auth/(sign)/signup/page.tsx` 裡的 `GoogleSignUpButton` 是獨立按鈕，不受這個 schema 或勾選狀態約束。
  - **因此**：這是兩條註冊路徑法遵要求不一致的已知落差，不是 email 表單刻意比較嚴格——如果同意條款是法遵要求，理論上兩條路徑都該擋。
  - **Reviewer 該做的事**：diff 若修改註冊同意條款相關邏輯，只改了 email/password 表單、沒有一併檢查 Google 註冊入口是否也需要對應機制，要主動提出來讓 Tech Lead 決定是否要補上，不能假設「改了 schema 就等於兩條路徑都合規」。

- **個人檔案編輯頁（`/profile/[pageUserId]/edit`）的存取權限是「pageUserId 必須等於目前登入者的 session id」，不符合就導回首頁，沒有例外（例如管理員代編）。** 見 `src/hooks/user/auth/useProfileAuth.ts`，`loginUserId !== pageUserId` 時直接 `router.push('/')`。
  - **因此**：任何人都不能編輯別人的個人檔案，這條檢查是唯一的存取控制層——如果之後要開放「管理員協助編輯」之類的需求，現有機制完全不支援，需要另外設計，不是加個 UI 判斷就好。
  - **Reviewer 該做的事**：diff 若在 profile edit 流程新增「代理編輯」或「檢視他人草稿」之類的功能，確認有沒有繞過或修改 `useProfileAuth` 的比對邏輯；若沒有動到這個 hook，這類需求大概率無法成立。

---

## Mentor Profile 資料一致性

- **Mentor 顯示用的 `job_title` / `company`（個人頁、mentor pool 卡片、預約列表都會讀）不是獨立欄位，是從 `work_experiences` 裡標記 `is_primary` 的那一筆鏡射出來的（沒有標記就取第一筆）。** 見 `src/hooks/user/profile/useProfileSubmit.ts` 的 `primaryWork` 計算與其上方註解："mirror the primary work experience so consumers... can read them directly... without re-deriving from the experience list."
  - **因此**：任何想「單獨修改 mentor 職稱/公司」的需求，正確做法是改 `work_experiences` 裡對應項目的 `is_primary` 或內容，而不是新增一個可以直接寫 `job_title`/`company` 的欄位或 API——那樣會跟 experiences 資料脫鉤，兩處顯示不一致。
  - **Reviewer 該做的事**：diff 若新增可以繞過 `work_experiences` 直接寫 `job_title`/`company` 的路徑，視為 Misplaced Implementation，應指向 `JobExperienceSection` 的 `is_primary` 機制。

---

## Mentor 搜尋 / 篩選 API 契約

- **`/v1/mentors` 的查詢參數（`MentorRequest`）必須是 snake_case，跟後端 query param 完全一致；camelCase 的 key 會被後端悄悄忽略，不會報錯。** 見 `src/services/search-mentor/mapMentor.ts` 的 `MentorRequest` 型別註解："a camelCase key here would silently be dropped by FastAPI's `search_pattern: str = Query(None)` and the keyword would have no effect."
  - **因此**：新增篩選條件時如果 key 命名錯誤，不會在前端看到任何錯誤或警告——篩選會安靜地失效，使用者只會覺得「篩選沒作用」，很難第一時間定位到是 key 命名問題。
  - **Reviewer 該做的事**：diff 若在 `MentorRequest` 新增欄位，確認命名是 snake_case 且與後端 query param 名稱完全一致；不能只看型別檢查通過就認定沒問題，因為 TypeScript 不會擋下命名錯誤的字串 key。
