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

### 2.2 常用開發輔助 Skills 使用手冊 (High-Frequency Skills Usage Guide)

以下為開發過程中最常用、頻率最高的 Skills 的詳細觸發與使用時機說明：

#### 1. 🚀 啟動任務票分支 (`start-ticket`)

- **何時使用**：當您準備開始開發 X-Tracker 上的新功能或修復 Bug 時。
- **如何使用**：在會話中輸入：
  ```text
  /start-ticket <GitHub Issue URL or Number>
  ```
- **執行動作**：AI 會自動切換回 `develop` 分支並拉取最新代碼、程式化在 `X-Talent-Frontend` 建立並綁定與 Tracker 關聯的新分支（如 `feat/372-slug`），並對 requirements 進行初步分析。

#### 2. 🧪 測試驅動開發 (`tdd`)

- **何時使用**：當您希望在實作功能之前「測試先行」，採用紅綠重構環路來確保程式碼品質與防禦力。
- **如何使用**：在會話中輸入：
  ```text
  /tdd
  ```
- **執行動作**：AI 會在背後分析適合置入測試的邊界（Seam），向您提出測試規劃並確認。確認後引導您進行「一項 failing test ➡️ 最小實作通過 ➡️ 審查與重構」的極速、穩健開發環路。

#### 3. 🔍 本地 AI 自動審查 (`ai-review`)

- **何時使用**：在實作完成、準備 commit 或 push 前，先在本地進行全方位的品質自檢。
- **如何使用**：在會話中輸入：
  ```text
  /ai-review
  ```
- **執行動作**：AI 會在本地同時啟動多個並行的子 Agent，從 **Security**（安全性）、**Correctness**（正確性）、**Business Logic**（業務邏輯是否完整符合任務單）、**Performance**（效能）、**Testing**（測試覆蓋率）等七個維度進行深度對比審查，給出具體且無 API 金鑰消耗的精準優化建議。

#### 4. 📦 提交代碼並建立 PR (`submit-pr`)

- **何時使用**：代碼經本地審查完畢、測試均通過，準備向 `develop` 發出合併請求。
- **如何使用**：在會話中輸入：
  ```text
  /submit-pr
  ```
- **執行動作**：自動執行專案的 TypeScript 編譯（type-check）、跑完所有 617 項 Vitest 測試、自動格式化（lint/prettier），撰寫標準格式的 commit 訊息（自動關聯 X-Tracker 任務單），自動推播至遠端，並呼叫 GitHub CLI 快速建立 Pull Request。

#### 5. 🩹 測試型別快速修復 (`migrate-to-shoehorn`)

- **何時使用**：當單元測試中的複雜型別 Mock 報錯，想要避免不安全的 `as unknown as Type` 斷言時。
- **如何使用**：在會話中輸入：
  ```text
  /migrate-to-shoehorn
  ```
- **執行動作**：自動將測試檔案中不安全的型別斷言（`as`）遷移至 Matt Pocock 推薦的 `@total-typescript/shoehorn` 套件，在確保測試代碼簡潔的同時，保障型別安全性。

#### 6. 🔥 規劃壓力測試與極限提問 (`grill-me`)

- **何時使用**：在開始實作複雜功能、或是進行重大架構調整前，希望由 AI 對您的思路進行嚴格壓力測試，提早發現潛在死角或安全風險時。
- **如何使用**：在會話中輸入：
  ```text
  /grill-me
  ```
- **執行動作**：AI 會扮演極度嚴苛的資深技術專家，針對您的開發計畫發起多輪「極限逼問」，直到您的解決方案細節完美無瑕、邊界情況與防禦邏輯皆充分考量。

#### 7. 🛠️ 精準功能實作與測試 (`implement`)

- **何時使用**：當規劃完成，手頭已有清晰的規格書 (Spec) 或具體的任務單 (Tickets)，準備進行精確、高維持性、型別安全的前端或邏輯程式碼實作時。
- **如何使用**：在會話中輸入：
  ```text
  /implement
  ```
- **執行動作**：AI 會嚴格遵循 Spec / Ticket 中的驗證指標（Acceptance Criteria）進行步驟化開發、補齊測試，並執行自動化 Linting 與 Type Checking。拒絕加入任何想像中的「just-in-case」冗餘程式碼，維持代碼庫極致整潔。

#### 8. 📝 討論收斂與規格生成 (`to-spec` / `spec`)

- **何時使用**：在與 AI 的深度討論中，方案已趨成熟，想要立刻將零散的對話收斂、沉澱為一份標準、具備高實作防禦性的技術規格書（Spec）並發佈至看板時。
- **如何使用**：在會話中輸入：
  ```text
  /to-spec
  ```
- **執行動作**：AI 會立刻回溯目前的對話上下文，自動彙整架構設計、邊界情況、欄位細節，生成完整的 `.md` 技術規格書並同步發佈至 Issue Tracker。

#### 9. 📐 規格細化與任務拆解 (`to-tickets` / `to-ticket`)

- **何時使用**：手頭已有一份規格書 (Spec)，準備動工前，想將其合理拆解為多個相依、有阻塞邊界（Blocked by）的最小實作任務單（Tickets），以發佈至 Tracker 看板上時。
- **如何使用**：在會話中輸入：
  ```text
  /to-tickets
  ```
- **執行動作**：AI 會分析規格內容，產出一個具備相依拓樸關係（Directed Acyclic Graph）的任務鏈，聲明好每個任務的阻塞邊緣，並程式化發佈至專案看板，方便 AI 或團隊多人協同開發。

#### 10. 🚦 任務分流與分類審查 (`triage`)

- **何時使用**：當有新 Issue 提報，或是收到外部 Pull Request，需要為其進行重現驗證、缺漏追問，並分類其為 AI 或人類可執行的狀態時。
- **如何使用**：在會話中輸入：
  ```text
  /triage
  ```
- **執行動作**：自動讀取並診斷該 Issue，若重現步驟不全會自動留言追問，若資訊齊全則移至對應的看板狀態，並為後續接手的開發者或 AI 撰寫一分高可讀性的開發簡報。

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
