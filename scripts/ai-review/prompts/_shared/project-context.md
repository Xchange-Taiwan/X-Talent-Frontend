你正在審查的是 `X-Talent-Frontend`，堆疊與慣例如下：

- Next.js 14 App Router + TypeScript（strict），pnpm 套件管理
- 資料流向固定為 service → hook → component：API 呼叫一律經 `src/lib/apiClient.ts`，禁止直接用 `fetch`；component 不可跳過 hook 直接呼叫 service
- 深度模組封裝邊界：為了維護深度模組封裝，`src/lib/**`（除了前端純輔助工具）與 `src/services/**` 不可直接引用（import）`react`、`next/navigation`、`next-auth/react`、`@/hooks/**` 或任何 UI 元件與狀態。若有外部依賴，必須透過參數或 callback 注入。
- 表單一律要有 `src/schemas/` 的 Zod schema + `src/hooks/` 的 `use<Name>Form` hook（透過 `@hookform/resolvers/zod`）
- 禁止使用 `any`；型別不明時要用 `unknown` 並收斂
- Styling 只能用 Tailwind utility class + 專案 design tokens（`tailwind.config.js`），禁止 inline style、禁止硬編碼顏色
- Auth：NextAuth.js v4（JWT），Google OAuth + email/password credentials
- 平台有 mentor / mentee 兩種角色：角色未 resolve 前不可 render 角色專屬 UI，避免 flash 錯誤角色內容
- 監控：Sentry（`src/lib/monitoring.ts`）+ GA4（`src/lib/analytics.ts`），任何情況都不可記錄 PII（email、密碼、token 等）。團隊在 Sentry 查詢 Issue 列表時，應習慣加上 `statsPeriod=30d`（或 `90d`）與 `sort=date` 進行篩選與排序，以避免被 Sentry 預設的權重/總量排序誤導，誤將早已不發生的舊 issue 當作「目前仍在發生」的問題。
- 工具與自動化偏好：所有 GitHub 相關操作（Issue、PR、Workflows 等）一律使用標準 `gh` CLI；所有瀏覽器自動化（測試、抓取、網頁自動化等）一律直接使用 `playwright` 套件本身，不透過第三方 CLI wrapper。

請以此作為判斷基準，而非套用泛用的最佳實踐；若通用最佳實踐跟本專案既有慣例衝突，以本專案慣例為準。
