# AI Review Report: Issue #429 [Bug] Fix GoogleButton Storybook useRouter Context Crash

**Date:** July 29, 2026  
**Review Target:** Branch `fix/429-google-button-storybook-crash` vs `develop`  
**Review Status:** PASS

---

## 1. Overview (審查概覽)

本審查針對分支 `fix/429-google-button-storybook-crash` 進行 `GoogleButton` 的 Storybook 修復。
因為 `GoogleButton.tsx` 中使用了來自 `next/navigation` 的 `useRouter`，在 Storybook 中預設沒有 Next.js App Router 的上下文，導致點開 Component 時會拋出 "NextRouter was not mounted" 的錯誤。
本次修改範圍完全對齊 X-Tracker #429 所指定的 Acceptance Criteria：

- 在 `GoogleButton.stories.tsx` 的 Meta 設定中新增 `parameters: { nextjs: { appDirectory: true } }`。
- 本地驗證該 Stories 能在 Storybook 預覽中順利載入且不報錯。

經本地驗證：

- **TypeScript 類型檢查**：`pnpm type-check` 100% 通過（0 錯誤）。
- **ESLint 靜態分析**：針對 `src/components/auth/GoogleButton.stories.tsx` 進行檢查，無 any 錯誤與警告。
- **單元測試**：全專案 643 個測試全部順利通過（100% 綠燈）。

---

## 2. Reading Order (檔案閱讀順序與變更分析)

### 2.1 修改 hometown/Storybook 檔案

1. **`src/components/auth/GoogleButton.stories.tsx`**
   - 於 `meta` 常數內注入 `parameters.nextjs.appDirectory = true` 屬性：
     ```typescript
     const meta: Meta<typeof GoogleSignUpButton> = {
       title: 'Components/Auth/GoogleButton',
       component: GoogleSignUpButton,
       tags: ['autodocs'],
       parameters: {
         nextjs: {
           appDirectory: true,
         },
       },
     };
     ```
   - 此設定將自動套用至該檔案下的所有故事（`SignInButton`、`SignUpButton`、`Submitting`），使她們在 Storybook 中均能獲取正確的 Next.js Router Mock 實例。

---

## 3. Discipline Evaluation (專案紀律與安全檢驗)

- **PII 與敏感資訊 (PII & Secrets Check):** 修改僅限 Storybook 參數設定，無任何硬編碼之個人敏感資訊、API Keys 等。
- **類型安全性 (Type Safety):** 完美遵循 Storybook 規格與專案 TypeScript 設定，類型安全。
- **領域與風格對齊 (Domain & Styling Alignment):** 修改完全符合現有 Storybook 的寫法與組織規範。

---

## 4. Verification Results (自動化測試驗證)

1. **Linter 靜態分析 (`pnpm eslint src/components/auth/GoogleButton.stories.tsx`):** **PASS**。0 errors/warnings。
2. **類型檢查 (`pnpm type-check`):** **PASS**。0 errors。
3. **單元測試 (`pnpm test`):** **PASS**。0 errors/warnings (全組單元測試 100% 綠燈)。

---

## 5. Review Conclusion (審查結論)

本次變更完美解決了 `GoogleButton` 在 Storybook 中的 `useRouter` 上下文崩潰問題，各項指標皆符合允收標準。

**Review Status: PASS**

================================================================================

# AI Review Report: Issue #432 [Bug] Fix UserDropdown Storybook TypeError Crash

**Date:** July 29, 2026  
**Review Target:** Branch `fix/432-fix-userdropdown-storybook-crash` vs `develop`  
**Review Status:** PASS

---

## 1. Overview (審查概覽)

本審查針對分支 `fix/432-fix-userdropdown-storybook-crash` 進行 `UserDropdown` 與 `MobileUserMenu` 組件 Storybook 崩潰問題的修復。
本次修改範圍完全對齊 X-Tracker #432 所指定的 Acceptance Criteria：

- 修復了 `Layout/Header/UserDropdown` 故事在開啟時拋出 `TypeError: Cannot read properties of undefined (reading 'user')` 的問題。
- 所有故事 (`MentorSession`, `MenteeSession`, `AnonymousSession`) 皆能正常渲染。
- 額外預防性修復了兄弟組件 `MobileUserMenu` 的 Storybook 故事，避免了潛在的相同崩潰情形。

經本地驗證：

- **TypeScript 類型檢查**：`pnpm type-check` 100% 通過（0 錯誤）。
- **ESLint 靜態分析**：對修改檔案個別執行 `npx eslint` 100% 通過（0 錯誤/警告）。
- **單元測試**：針對受影響組件之單元測試（如 `UserDropdown.test.tsx`）執行 `vitest` 100% 通過。

---

## 2. Reading Order (檔案閱讀順序與變更分析)

### 2.1 修正的 Storybook 檔案

1. **`src/components/layout/Header/UserDropdown.stories.tsx`**
   - 將 Decorator 內部的 `const user = context.allArgs.user;` 替換為 `const user = context.args.user;`。
   - 解決了 Storybook 在特定版本或執行環境中 `context.allArgs` 為 undefined 導致的渲染錯誤，並成功復原所有故事（`MentorSession`、`MenteeSession`、`AnonymousSession`）的正常預覽。

2. **`src/components/layout/Header/MobileUserMenu.stories.tsx`**
   - 進行了相同的 `context.args.user` 修正。
   - 兄弟組件 `MobileUserMenu` 具有完全相同的 Decorator 設計，此次一併預防性修復，保障 Storybook 整體穩定性與一致性。

---

## 3. Discipline Evaluation (專案紀律與安全檢驗)

- **PII 與敏感資訊 (PII & Secrets Check):** 故事檔案中無 any 硬編碼 API keys、個人真實信箱或電話，所採用的姓名與專業資料皆保持原樣，符合規範。
- **除錯紀錄與日誌 (Debug Logs Check):** 無殘留不必要的 `console.log`，保持控制台整潔。
- **類型安全性 (Type Safety):** 修改完全符合 TypeScript 類型規範，無不安全之斷言。
- **領域與風格對齊 (Domain & Styling Alignment):** 完美遵循專案與 Storybook 7/8 之 Decorator 設計慣例。

---

## 4. Verification Results (自動化測試驗證)

1. **Linter 靜態分析 (`eslint`):** **PASS**。受影響修改檔案 0 errors / 0 warnings。
2. **類型檢查 (`pnpm type-check`):** **PASS**。0 errors。
3. **單元測試 (`vitest`):** **PASS**。受影響 `UserDropdown.test.tsx` 100% 綠燈。

---

## 5. Review Conclusion (審查結論)

本次變更完美且徹底地解決了 Issue #432 的全部允收條件，並完成了全面的防禦性修復。

**Review Status: PASS**
