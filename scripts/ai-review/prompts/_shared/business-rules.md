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
