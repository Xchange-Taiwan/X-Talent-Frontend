# X-Talent Frontend 開發與 AI 協同規範 (GEMINI.md)

> 💡 **如果你只有 10 秒鐘，呼叫這個 Skill 就夠了！** ➡️ 直接在會話中輸入 `/implement <ticket-url>` 即可一鍵自動化完成「拉取任務票 ➡️ 精準開發 ➡️ AI 自動審查 ➡️ 自動建立 PR」的端到端工作流。

---

## 1. 快速上手與環境設定 (Quick Start)

### 1.1 安裝與啟動

1. **安裝依賴**：`pnpm install` (本專案已將 `gemini-cli` 納入 `devDependencies`)
2. **啟動會話**：`pnpm exec gemini` (欲開啟無人值守自主模式，請加 `--yolo`)

### 1.2 啟用本地信任 (CRITICAL)

專案內置的 Local Skills (置於 `.agents/skills/`) 需獲得信任授權始可載入。

- **互動模式**：進入會話後輸入 `/trust` 並重啟會話。
- **非互動/CI 環境**：設定環境變數 `export GEMINI_CLI_TRUST_WORKSPACE=true`。

---

## 2. 核心本地 Skills 使用手冊 (Core Local Skills)

在會話中輸入 `/skills list` 列出所有 36 個 Skills。以下為最常用的核心技能：

| 指令                                 | 適用時機                 | 執行動作                                                                                                                                                                                |
| :----------------------------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/implement <ticket-url>`**        | 開始新開發或修復時       | **【旗艦自動化 ⭐️】** 自動調用 `/start-ticket <ticket-url>` 拉取 X-Tracker 需求 ➡️ 進行精準開發與 TDD ➡️ 本地並行 `/ai-review` ➡️ `/submit-pr` 一鍵完成品質校驗、Commit 並自動建立 PR。 |
| **`/start-ticket <ticket-url>`**     | 欲單獨啟動分支時         | 自動切回 `develop`，建立並在遠端關聯分支，動態讀取 `project-config.md` 設定檔拉取任務票上下文。                                                                                         |
| **`/tdd`**                           | 開始實作功能前           | 採用紅綠重構環路，在 pre-agreed seams（確認邊界）下進行測試先行開發。                                                                                                                   |
| **`/ai-review`**                     | Commit/Push 前           | 本地並行啟動多子 Agent 從 Security, Correctness, Business, Performance 等維度進行無 API 金鑰消耗自檢。                                                                                  |
| **`/submit-pr`**                     | 功能開發完畢時           | 跑完編譯與所有單元測試 ➡️ 格式化 ➡️ 提交 Commit（自動關聯 #號）➡️ Push 並動態讀取 `project-config.md` 設定檔自動建立 PR 與更新專案看板狀態。                                            |
| **`/migrate-to-shoehorn`**           | 測試 Mock 資料型別報錯時 | 一鍵將測試中不安全的 `as any` 斷言自動遷移成型別安全的「局部 Mock 語法」（免除手動補齊複雜型別中數十個無關欄位的痛苦）。                                                                |
| **`/improve-codebase-architecture`** | 欲優化專案架構時         | 深度掃描代碼庫並生成視覺化的 HTML 架構報告，找出模組深化（Deepening）與重構優化的黃金機會。                                                                                             |
| **`/to-spec`**                       | 方案討論完畢時           | 將對話上下文快速收斂成技術規格書（Spec）並發佈。                                                                                                                                        |
| **`/to-tickets`**                    | 動工前拆解任務時         | 將 Spec 依拓樸關係合理拆解為多個相依、有阻塞邊界（Blocked by）的 Tickets，並動態讀取 `project-config.md` 設定檔自動發佈至看板 Backlog。                                                 |
| **`/triage`**                        | 收到新 Issue/PR 時       | 進行重現驗證與分類（`ready-for-agent` / `ready-for-human`）。                                                                                                                           |

---

## 3. 頂級工程規範 (Engineering Standards)

本專案之 AI 審查與團隊開發已深度對齊以下工程規範，所有團隊成員與 AI 均須遵守：

1. **領域與技術慣例事實來源 (Single Source of Truth)**：
   本專案的統一領域術語（Domain Invariants）、技術棧與程式開發慣例，其**唯一真實事實來源**為 `scripts/ai-review/prompts/_shared/` 底下的規則檔案（包含 `project-context.md` 與 `business-rules.md`）。而 `GEMINI.md` 本身僅作為面向人類開發者的快速入門與摘要投影。進行任何實作與審查時，必須優先閱讀上述 `_shared/` 目錄內之規則檔案，確保對齊統一語言與架構約定。
2. **架構決策追蹤 (`docs/adr/`) 【暫未採用】**：
   本專案目前尚未啟用硬性 ADR (Architecture Decision Records) 決策追蹤機制。未來若評估有需求，將另開 Issue 實作。
3. **深度模組封裝 (`Deep Modules`) 【由 AI Review 防禦】**：
   具體實作細節應隱藏在子目錄中，外部僅能透過 `index.ts` 導出。
   - **硬性工具鏈防禦 (Dependency Cruiser)**：**【尚未啟用】**。
   - **軟性規則防禦 (AI Review Boundary Rules)**：**【已啟用】**。專案已在 `_shared/project-context.md` 中寫明文字規則，限制 `src/lib/**` 與 `src/services/**` 直接引用前端 React/Next UI 或狀態依賴。CI 的 AI Review 流程會對此進行嚴格自動化阻攔。
4. **測試拒絕 `as` 斷言 (Shoehorn) 【已啟用】**：
   本專案已安裝並啟用 `@total-typescript/shoehorn` 局部 Mock 套件。在編寫測試（`*.test.ts` / `*.spec.ts`）時，**嚴格禁止**在測試資料中使用不安全的 `as any` 或 `as ComplexType` 雙重斷言。請優先採用 `@total-typescript/shoehorn` 提供之 `fromPartial()`（局部型別安全 Mock）與 `fromAny()`（故意傳遞錯誤型別之測試）函式，確保測試資料的型別安全性（已於 `src/lib/profile/pollUntilSynced.test.ts` 中完成範例落地與驗證）。

---

## 4. 頂級 Git Commit Message 規範 (Conventional Commits Standard)

本專案嚴格遵循 **Conventional Commits 1.0.0** 規範，確保提交歷史的可讀性、可追溯性與 CI/CD 自動化的流暢性。不論是人類開發者還是 AI Agent，所有的 Commit Message 均須遵守以下結構：

```
<type>(<scope>): <subject> (X-Tracker #<issue-number>)

<body>

<footer>
```

### 4.1 核心欄位定義

1. **`<type>`（提交類型，必要）**：
   - `feat`: 新增功能（Features）。
   - `fix`: 修補錯誤（Bug Fixes）。
   - `docs`: 僅修改文件（Documentation）。
   - `style`: 程式碼格式調整，不影響程式邏輯（Formatting, missing semi-colons, etc.）。
   - `refactor`: 重構，非新增功能也非修復 Bug（Code refactoring）。
   - `perf`: 提升效能的修改（Performance improvements）。
   - `test`: 新增或修改測試案例（Testing）。
   - `chore`: 建置流程或輔助工具的變更（Chore / Build config / workflow）。
   - `ci`: CI/CD 流程或腳本的修改（CI configuration / GitHub workflows）。
   - `revert`: 還原先前的提交（Revert a previous commit）。

2. **`<scope>`（影響範圍，選填但強烈建議）**：
   - 指明此修改影響的專案模組、頁面或組件（例如：`auth`, `profile`, `reservation`, `skills`, `ui` 等）。

3. **`<subject>`（主旨簡述，必要）**：
   - 採用祈使句、現在式、首字小寫（例如：`add login validations` 而非 `Added login validations` 或 `adds login validations`）。
   - 不以點號 `.` 結尾。

4. **`(X-Tracker #<issue-number>)`（關聯 Tracker Issue，本專案硬性要求）**：
   - 所有的開發提交必須在主旨末尾標註其關聯的 X-Talent-Tracker 任務票號，格式為 `(X-Tracker #<issue-number>)`。

5. **`<body>`（詳細描述，選填）**：
   - 說明修改的動機、設計決策以及與先前行為的對比。

6. **`<footer>`（頁尾資訊，選填）**：
   - 用於關聯重大變更（Breaking Changes）或關閉特定的 GitHub Issue，例如：`Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/374` 或 `Closes #374`。

### 4.2 範例

#### 範例 1：新增功能（帶 Scope 與詳細說明）

```text
feat(auth): integrate google oauth token exchange (X-Tracker #102)

Configure NextAuth to perform cross-repo token verification and refresh.
Handle cases where the session email is missing from the OAuth response payload.

Ref: https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/102
```

#### 範例 2：修復 Bug（關閉 Issue）

```text
fix(skills): resolve null ID error in project status transition (X-Tracker #374)

Implement secure option ID truthiness checking and strip Windows carriage returns.
This ensures PowerShell and Bash environments never pass invalid parameters.

Closes #374
```
