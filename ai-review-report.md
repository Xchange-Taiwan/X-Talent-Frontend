# AI Review Report: Issue #428 [Bug] Fix ForgotPasswordLink Storybook useRouter Context Crash

**Date:** July 29, 2026  
**Review Target:** Branch `fix/428-forgot-password-link-storybook-crash` vs `develop`  
**Review Status:** PASS

---

## 1. Overview (審查概覽)

本審查針對分支 `fix/428-forgot-password-link-storybook-crash` 進行 `ForgotPasswordLink.stories.tsx` 崩潰問題的修復。
由於 `ForgotPasswordLink.tsx` 在渲染時調用了來自 `next/navigation` 的 `useRouter()`，在 Storybook 環境中渲染該組件會因為缺乏 Next.js App Router 上下文而拋出 "NextRouter was not mounted" 錯誤。
本次修改完全對齊 X-Tracker #428 所指定的 Acceptance Criteria：

- 在 `ForgotPasswordLink.stories.tsx` 的 Storybook Meta 配置中新增 `parameters: { nextjs: { appDirectory: true } }`。
- 這樣可以讓 Storybook `@storybook/nextjs` 框架正確載入並掛載 App Router 的 mock 路由上下文，解決 NextRouter 未掛載的錯誤。
- 修復後組件得以在 Storybook 中正常加載與渲染。

經本地驗證：

- **TypeScript 類型檢查**：`pnpm type-check` 100% 通過（0 錯誤）。
- **ESLint 靜態分析與格式化**：`pnpm format` 格式化排版，`npx eslint src/components/auth/signin/ForgotPasswordLink.stories.tsx` 0 錯誤。
- **單元測試**：`pnpm test` 100% 通過（643 個測試全綠）。

---

## 2. Reading Order (檔案閱讀順序與變更分析)

### 2.1 修改的 Storybook 檔案 (ForgotPasswordLink)

1. **`src/components/auth/signin/ForgotPasswordLink.stories.tsx`**
   - 在 `meta` 物件中加入了 `parameters` 屬性，指定 `nextjs.appDirectory: true`。
   - 這是 `@storybook/nextjs` 官方指定用來模擬 Next.js 13+ App Router 的標準配置，能為該 Story 內的組件提供 Mock 版的 `useRouter` 上下文。

---

## 3. Discipline Evaluation (專案紀律與安全檢驗)

- **PII 與敏感資訊 (PII & Secrets Check):** 無敏感資訊洩露。
- **除錯紀錄與日誌 (Debug Logs Check):** 無殘留 debug `console.log`。
- **類型安全性 (Type Safety):** 完美對齊 TypeScript 類型，使用 `@storybook/nextjs` 的 `Meta` 類型進行聲明，類型檢查無誤。
- **領域與風格對齊 (Domain & Styling Alignment):** 改動極具針對性，無無關改動，代碼風格完全一致。

---

## 4. Verification Results (自動化測試验证)

1. **Linter 靜態分析 (`pnpm lint`對單一檔案):** **PASS**。0 errors。
2. **類型檢查 (`pnpm type-check`):** **PASS**。0 errors。
3. **單元測試 (`pnpm test`):** **PASS**。0 errors/warnings (單元測試 100% 綠燈)。

---

## 5. Review Conclusion (審查結論)

本次變更完美解決了故事書渲染崩潰的問題，且代碼與配置完全正確，符合專案高標準之工程規範。

**Review Status: PASS**
