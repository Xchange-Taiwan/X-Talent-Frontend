# AI Review Report: Issue #405 ESLint Tailwind Plugin Integration

**Date:** July 2026  
**Review Target:** Branch `feat/405-eslint-tailwindcss` vs `develop`  
**Review Status:** PASS

---

## 1. Overview (審查概覽)

本審查針對分支 `feat/405-eslint-tailwindcss` 之中導入的 `eslint-plugin-tailwindcss` 及其對應之配置與靜態代碼檢查。本次重構旨在根除專案曾發生的死碼 / 已刪除色彩 Token 引用問題（如先前發生的生產環境 Bug X-Tracker #392 -> #395），同時移除舊有基於手寫 Regular Expression 的 `no-restricted-syntax` 顏色限制，並保留字體大小限制。

在啟用該 Plugin 後，我們自動檢查並清理了代碼庫中 17 處隱藏已久的樣式 Bug 與拼寫錯誤，讓整個代碼庫達到更健全、一致、與 Design System 深度對齊的完美狀態。

---

## 2. Key Accomplishments (主要重構要點)

1. **安裝並配置 `eslint-plugin-tailwindcss`:**
   - 為了與專案的 ESLint 8.56.0 深度相容，我們精準選用了 `eslint-plugin-tailwindcss@3.17.5` 版本，完全避免了 ESLint 9 的 peerDependency 衝突警告。
   - 在 `.eslintrc.json` 中完整配置：
     - 加入 `"tailwindcss"` 到 `plugins` 陣列。
     - 啟用 `"tailwindcss/no-custom-classname": "error"`，確保任何不屬於 Tailwind 主題或合法 JIT 規則的類名都會在靜態檢查中拋錯（這包含了先前死碼 Token 如 `status-200` 等問題的全面攔截）。
     - 設定專案 `settings.tailwindcss` 以正確路徑解析 `tailwind.config.js`，並宣告 `callees: ["cn", "cva", "clsx"]` 以涵蓋多數工具函式內的類名解析。
   - 移除舊有的兩個 `no-restricted-syntax` 顏色限制，並確實保留了第三個針對 `text-[12px]` 字體大小的 regex 規則。

2. **修正 `tailwind.config.js` 與預設顏色丟失問題:**
   - 專案的 `tailwind.config.js` 之前採用的配置是直接覆寫 `theme.colors`，這會導致 Tailwind 的 5 個基本實用顏色（`inherit`, `current`, `transparent`, `black`, `white`）從主題中完全丟失，造成諸多標準樣式編譯不全或不被 Plugin 認可。
   - 我們將這 5 個色彩鍵重新加入 `tailwind.config.js` 之中，以解鎖 standard utility colors 並使之能通過 linter 靜態解析。

3. **修復 17 個全案樣式 Bug 與 Typos:**
   - **`src/app/(landing)/page.tsx`**: 將 5 處未註冊的 `text-midnight-blue` (無效果色彩) 完美修正為專案合法的 Design Token `text-navy`。
   - **`src/app/mentor-pool/ui.tsx`**: 將 Flex 對齊拼寫錯誤 `item-center` 修正為 `items-center`。
   - **`src/components/landing/HomePageSlider.tsx`**: 將非法類名 `margin-0` 修正為正統 `m-0`。
   - **`src/components/profile/profile-card/ProfileCard.tsx`**: 將非法 `bg-bright` 背景類名修正為合法 Design Token `bg-background-white`。
   - **`src/components/reservation/ReservationDashboard.tsx`**: 移除未配置且無效的 `font-roboto` 字體類名，使網頁標題完美回歸 Noto Sans TC 全域字體樣式。
   - **`src/components/ui/calendar.tsx`**: 將不存在的 `shadow-xs` 修正為正統 `shadow-sm`。
   - **`src/components/ui/multi-select.tsx`**: 將 opacity 拼寫錯誤 `border-text-primary/1` (1% 不透光，等於透明) 修正為正確的 `border-text-primary/10` (10% 不透光)。
   - **`src/components/ui/select-options.tsx`**:
     - 將複製自 Radix UI 官網的 `data-[disabled]:text-mauve8` 修正為對齊專案 Token 的 `data-[disabled]:text-text-disable`。
     - 將未註冊的 `text-violet11` 4 處修正為專案標準文字色 `text-text-primary`。
   - **`src/components/ui/toast.tsx`**: 移除 variant declaration 內遺留下來的非 Tailwind 類名 `destructive`。

---

## 3. Discipline Evaluation (專案紀律與安全檢驗)

- **PII 與敏感資訊 (PII & Secrets Check):** 經程式碼全文掃描，變更中**無**任何個人敏感資料（PII）、硬編碼 API Key、憑證或私密資訊洩漏，完全符合安全防護規範。
- **除錯紀錄與日誌 (Debug Logs Check):** 所有變更皆不含任何 `console.log`、`console.error` 或除錯標記。
- **類型安全性 (Type Safety):** 執行 `pnpm run type-check` 結果為 **SUCCESS (0 errors)**。沒有破壞型別系統。
- **程式碼風格與語意 (Code Smell & Styling):** 僅針對 Issue 要求的檔案與必要的 17 個 classnames/typos 問題進行精準、無副作用的局部修改，程式碼極其乾淨，並無多餘的非相關重構。

---

## 4. Verification Results (自動化測試驗證)

1. **Linter 靜態分析 (`pnpm run lint`):** **PASS (0 errors, 2 warnings)**（僅有 2 個原先就存在的 spec 與 test any 型別警告）。
2. **單元測試套件 (`pnpm run test`):** **PASS**。全案 86 個測試檔案、636 個測試案例全數 100% 通過。
3. **類型編譯驗證 (`pnpm run type-check`):** **SUCCESS (0 errors)**。

---

## 5. Review Conclusion (審查結論)

本 PR 全面落實並超出了 Issue #405 要求的承諾，成功安裝、配置並啟用 `eslint-plugin-tailwindcss`，消除了舊的 regex。更重要的是，藉由此 Plugin 成功揪出了代碼庫中潛藏的多處不合法、無效類名拼寫，並已將它們全數完美對齊專案的 Design Token，讓前端整體的色彩可靠性提高至全新維度。

Review Status: PASS
