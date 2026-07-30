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

- **PII 與敏感資訊 (PII & Secrets Check):** 修改僅限 Storybook 參數設定，無 any 個人敏感資訊、API Keys 等。
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

# AI Review Report: Issue #431 & #432 [Bug] Fix Storybook TypeError Crash (MobileUserMenu & UserDropdown)

**Date:** July 29, 2026  
**Review Target:** Branch `fix/431-fix-mobileusermenu-storybook-crash` vs `develop`  
**Review Status:** PASS

---

## 1. Overview (審查概覽)

本審查針對分支 `fix/431-fix-mobileusermenu-storybook-crash` 進行 MobileUserMenu 及 UserDropdown 的 Storybook 元件修復。
本次修改範圍完全對齊 X-Tracker #431 及 #432 所指定的 Acceptance Criteria：

- 修復 `MobileUserMenu.stories.tsx` 及 `UserDropdown.stories.tsx` 中的裝飾器崩潰。原先裝飾器存取 `context.allArgs.user` 導致 undefined 錯誤，現已修正為讀取標準 Storybook 提供的 `context.args.user`。
- 確保所有 Storybook 檔案（`MobileUserMenu.stories.tsx` 及 `UserDropdown.stories.tsx`）中的故事（`MentorSession`、`MenteeSession`、`AnonymousSession`）皆能正常編譯、載入與渲染。

經本地驗證：

- **TypeScript 類型檢查**：`pnpm run type-check` 100% 通過（0 錯誤）。
- **單元測試**：`pnpm run test` 100% 通過（643/643 綠燈）。
- **Storybook 建置檢查**：`pnpm run build-storybook` 100% 成功建置，無任何編譯或主控台錯誤。

---

## 2. Reading Order (檔案閱讀順序與變更分析)

### 2.1 修正的 Storybook 檔案

1. **`src/components/layout/Header/MobileUserMenu.stories.tsx`**
   - 將 `const user = context.allArgs.user;` 修正為 `const user = context.args.user;`。
   - 確保裝飾器中傳遞至 `SessionProvider` 的 mock session 資料能夠正常獲得 `user`，保證手機版使用者選單在 Storybook 中正確渲染其資訊與導航。

2. **`src/components/layout/Header/UserDropdown.stories.tsx`**
   - 一併將 `const user = context.allArgs.user;` 修正為 `const user = context.args.user;`。
   - 避免桌面版使用者下拉選單故事在載入時出現與 `MobileUserMenu` 相同的 crash，保持兩個選單組件故事的高可用性。

---

## 3. Discipline Evaluation (專案紀律與安全檢驗)

- **PII 與敏感資訊 (PII & Secrets Check):** 故事檔案中無 any e-mail 或硬編碼 API keys、個人真實信箱或電話，所採用的姓名與專業資料皆與專案 Mock 資料規範保持完美一致。
- **除錯紀錄與日誌 (Debug Logs Check):** 無殘留不必要的 `console.log`，保持控制台整潔。
- **類型安全性 (Type Safety):** 完全對齊專案 TS 類型規範，確保類型安全性。
- **領域與風格對齊 (Domain & Styling Alignment):** 修改精準、安全，不影響原有 UI 元件的任何業務與呈現邏輯。

---

## 4. Verification Results (自動化測試驗證)

1. **類型檢查 (`pnpm run type-check`):** **PASS**。0 errors。
2. **單元測試 (`pnpm run test`):** **PASS**。0 errors/warnings (全組單元測試 100% 綠燈)。
3. **編譯驗證 (`pnpm run build-storybook`):** **SUCCESS**。無 Console 錯誤。

---

## 5. Review Conclusion (審查結論)

本次變更精確、乾淨地修復了 Issue #431 與 #432 所描述的全部 Bug 與故事崩潰問題，並完成全面的防禦性修復。

**Review Status: PASS**
