這份文件收錄「不會寫在單一 ticket 裡、但整個平台都要遵守」的業務規則（domain invariants）。目的是讓 Business Logic Reviewer 不需要靠 tribal knowledge，也能判斷一個 PR 是不是做了「技術上邏輯正確、但業務上根本不該存在」的事。

**維護方式**：只要 AI reviewer（或人類 reviewer）事後發現漏掉一個「因為不懂平台業務規則而犯的錯」，就把那條規則寫進來，避免同一類錯誤在下一個 PR 又發生一次。每條規則都要附上「為什麼」跟「reviewer 該怎麼做」，單純條列規則但沒有依據，之後很容易被誤用或誤判成過時。

---

## 角色與 Onboarding

- **Onboarding 流程（`src/app/auth/(sign)/onboarding/**`、`src/components/onboarding/**`）永遠只有 mentee 會走過。** 使用者在完成 onboarding 之前不可能是 mentor —— `session.user.isMentor` / DTO 的 `is_mentor` 在這個流程裡永遠是 `false`（`buildOnboardingDtoStub` 也是以此為前提，預設 `isMentor: false`）。
  - **因此**：onboarding 相關檔案裡任何依賴 `isMentor` / `is_mentor` 為 `true` 的分支，都是永遠不會執行的死路（unreachable code）。
  - **案例**：PR #641「mentor 需強制上傳頭像」在 `src/app/auth/(sign)/onboarding/container.tsx` 加了 `if (isMentor && !avatar)` 檢查，這段永遠不會觸發；正確的位置是 `/profile/[pageUserId]/edit`（該 PR 也確實同時改了 `profile/edit/container.tsx` 與 `profileSchema.ts`，onboarding 那份是多餘的實作）。
  - **Reviewer 該做的事**：只要看到 onboarding 相關檔案裡出現 mentor-only 分支、或新增邏輯依賴 `isMentor`/`is_mentor` 為真，一律回報為「業務邏輯不成立，應移除或搬到 profile edit 流程」。

- 角色專屬 UI 在角色 resolve 前不可 render（見 project context）是「時序」問題，跟上面「onboarding 裡沒有 mentor」是不同層次的規則——前者是「還不知道角色」，後者是「這個流程裡角色的答案永遠已知且固定」，兩者都要檢查，不要混為一談。
