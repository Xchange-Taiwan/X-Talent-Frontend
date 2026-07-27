# X-Talent Frontend 開發與 AI 協同規範 (GEMINI.md)

歡迎來到 **X-Talent-Frontend** 專案！本文件為開發團隊、新加入的工程師以及所有協同 AI Agent（如 Gemini CLI）設定了統一的開發、審查與品質檢驗流程。

---

## 1. 專案技術棧與架構規範

本專案是一個現代化的前端平台，採用以下技術體系：

- **框架**：Next.js (App Router), React, TypeScript
- **樣式**：Vanilla CSS 與 Tailwind CSS
- **代碼規範**：ESLint, Prettier
- **單元/整合測試**：Vitest (`vitest.config.mts`)
- **端到端 (E2E) 測試**：Playwright (`playwright.config.ts`, `e2e/` 目錄)
- **錯誤監控**：Sentry

請在進行任何開發時：

1. **嚴格遵循型別安全**：避免使用 `any`、不當的型別斷言（如 `as`）或抑制 Linter 警告的註解。
2. **優先進行測試驗證**：新增功能或修復 Bug 時，必須伴隨對應的單元測試或 E2E 測試。
3. **遵循語意化命名**：元件、Hooks、Services 與 Schema 必須清晰命名，並放置於指定的目錄架構中。

---

## 2. 本地開發輔助 Skills (Local Agent Skills)

為了解決工作流標準化、免除重複設定，並確保 AI 助手在開發與代碼審查時能基於本專案最精準的上下文執行，我們在 `.agents/skills/` 目錄中導入了專案專屬的本地開發輔助 Skills。

### 2.1 核心 Skills 列表

本專案內置了 36 個高度優化的本地開發 Skills（位於 `.agents/skills/<skill-name>/`）：

- **開發與實作 (Development & Implementation)**
  - `implement`：基於 Spec 或 Tickets 進行步驟清晰、完整的 surgical feature 實作。
  - `tdd`：測試驅動開發 (Red-Green-Refactor)，專案包含對應的 mock 規範與單元測試實踐。
  - `diagnosing-bugs`：用於硬體/軟體 Bug、回歸問題的深度診斷與除錯。
  - `prototype`：快速構建、測試拋棄式的核心元件或邏輯原型。

- **工作流管理 (Workflow & PR Management)**
  - `start-ticket`：建立並關聯 Issue 分支，拉取最新 develop，程式化綁定 Issue 與 Branch。
  - `submit-pr`：自動執行專案品質檢查、格式化、提交並生成 PR。
  - `resolving-merge-conflicts`：針對 Git 衝突的標準安全解決機制。
  - `triage`：對 Issue 或 PR 進行分類與初步審查。

- **代碼品質與審查 (Quality & Review)**
  - `ai-review`：本地執行並行的 Security, Correctness, Business, Performance, Testing, Architecture 審查。
  - `code-review`：以資深架構師視角審查當前分支與目標分支（如 `develop`）的差異。

- **專案與架構配置 (Project & Architecture Setup)**
  - `setup-pre-commit`：一鍵設定本專案的 Husky、Prettier、Linter 等提交前置檢查。
  - `setup-ts-deep-modules`：設定 TypeScript 深度模組結構與 Dependency Cruiser，保障架構邊界。
  - `domain-modeling`：定義、修正與對齊專案的領域模型，生成 Ubiquitous Language 詞彙表。
  - `improve-codebase-architecture`：掃描並生成視覺化架構報告，找出重構機會。

- **規劃、引導與溝通 (Planning, Grilling & Consulting)**
  - `ask-matt` / `find-skills`：快速索引並引導使用最合適的 Skill。
  - `grill-me` / `grilling` / `grill-with-docs`：透過嚴格提問來精煉開發計畫，生成 ADR 與詞彙表。
  - `to-spec` / `to-tickets` / `to-questionnaire`：將對話、規劃轉換成具體規格書、Tracker 任務單或問題清單。
  - `research`：進行深度的技術/文檔調研，並在專案中生成 Markdown 檔案。

---

## 3. 如何啟用並驗證 Local Skills

### 3.1 安裝與配置依賴環境 (Environment Setup)

為確保團隊成員環境標準化，我們已將 Gemini CLI 作為開發依賴項納入專案之 `devDependencies`。

1. **安裝依賴**：請在專案根目錄下執行：
   ```bash
   pnpm install
   ```
2. **啟動/執行 CLI**：安裝完成後，可以使用 `pnpm` 執行器來開啟本地會話：
   ```bash
   pnpm exec gemini
   ```
   或是使用 global 的 `gemini` 指令（若您在全域有安裝）。

### 3.2 啟用本地信任 (CRITICAL)

由於 Workspace Skills 可以執行自訂腳本以進行代碼自動化生成與測試，**Gemini CLI 在預設情況下會忽略本地 Workspace Skills，直到該目錄被標記為信任**。

#### 在互動模式下啟用：

1. 在終端機進入專案根目錄並開啟 Gemini CLI 會話。
2. 執行 `/trust` 指令。
3. 重新啟動會話以載入 Skills。

#### 在非互動模式 / CI/CD 環境下啟用：

請將環境變數設定為：

```bash
export GEMINI_CLI_TRUST_WORKSPACE=true
```

### 3.3 啟用自主執行模式 (YOLO Mode)

在進行複雜開發、批次重構，或需要 AI 連續自主執行（不中斷彈出確認視窗）時，可以啟用 **YOLO Mode**。

- **互動模式啟動**：
  ```bash
  pnpm exec gemini --yolo
  ```
- **環境變數啟用（非互動或 CI/CD 環境下）**：
  請設定環境變數：
  ```bash
  export GEMINI_CLI_YOLO=true
  ```

### 3.4 檢查與列出 Skills

要驗證 Local Skills 是否已被順利識別與載入，請在會話中執行：

```bash
/skills list
```

或者在終端機中執行：

```bash
gemini skills list
```

你將看到所有位於 `.agents/skills/` 的專案專屬 Skills 呈現在清單中。

---

## 4. 協同 AI 開發最佳實踐

1. **優先使用 TDD 模式**：請在使用 Agent 新增功能前，提示 Agent 啟用 `/tdd` 技能，確保測試先行。
2. **提交 PR 前執行本地 AI 審查**：完成功能實作後，請執行 `/ai-review`，以便在本地自動進行安全性、效能及架構等多面向審查，解決所有 critical issues 後再提出 PR。
3. **保持專案記憶更新**：每次完成階段性架構決策或遇到機器專屬設定時，請指示 Agent 更新本地私有記憶體 `MEMORY.md`。

---

## 5. Matt Pocock 核心工程技能與規範 (TypeScript & Domain Engineering Standards)

本專案高度借鑑並導入了 TypeScript 大師 Matt Pocock (Total TypeScript 創辦人) 的經典工程學實踐。所有團隊成員與 AI 協同開發時，均須遵循以下三大核心規範：

### 5.1 領域導向文檔與統一語言 (Domain Docs & Context Rule)

為了避免名詞混淆，並使程式碼結構高度契合業務領域：

- **`CONTEXT.md` 優先閱讀**：在探索代碼庫或新增功能前，AI Agent 必須閱讀專案根目錄的 `CONTEXT.md`（或 `CONTEXT-MAP.md`），以對齊專案的「統一語言（Ubiquitous Language）」與領域術語，切勿隨意自造同義詞。
- **ADR 架構決策紀錄 (`docs/adr/`)**：專案的核心架構演進與設計決策均記錄於 `docs/adr/` 中。新增代碼若與現有 ADR 衝突，必須在 PR 中明確指出（例如：_「本設計與 ADR-0002 衝突，但因...故建議調整」_）。
- **對應本地 Skill**：`setup-matt-pocock-skills`, `domain-modeling`, `grill-with-docs`

### 5.2 深度 TS 模組架構 (TypeScript Deep Modules)

為了防止程式碼邊界模糊（Spaghetti Code）：

- **模組封裝**：專案模組應設計成「深度模組」，即將具體實作細節隱藏在 subfolders 之中，外部僅能透過模組的入口進入點檔案（如 `index.ts`）進行有限且安全的導出與引用。
- **邊界防護**：專案採用 Dependency Cruiser 來偵測並防範越權引用或循環依賴。
- **對應本地 Skill**：`setup-ts-deep-modules`

### 5.3 單元測試拒絕 `as` 斷言 (`migrate-to-shoehorn` 規範)

在編寫 Vitest 單元測試時，測試資料的 Mock 經常面臨 TypeScript 複雜型別檢查的考驗：

- **反模式 (Anti-pattern)**：嚴格禁止在測試資料中使用 `as unknown as ComplexType` 或 `as any` 來繞過編譯檢查。這會隱藏真正的介面變更，導致測試失去防禦力。
- **最佳實踐**：請優先採用 Matt Pocock 開源的測試資料輔助庫 **`@total-typescript/shoehorn`**。它允許您編寫局部的、安全的 Mock 資料且不會損壞型別安全性。
- **對應本地 Skill**：`migrate-to-shoehorn`

---

**讓 AI 為 X-Talent 的代碼品質保駕護航，Happy Coding!**
