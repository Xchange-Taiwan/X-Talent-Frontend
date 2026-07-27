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
| **`/start-ticket <ticket-url>`**     | 欲單獨啟動分支時         | 自動切回 `develop`，建立並在遠端關聯分支，拉取任務票上下文。                                                                                                                            |
| **`/tdd`**                           | 開始實作功能前           | 採用紅綠重構環路，在 pre-agreed seams（確認邊界）下進行測試先行開發。                                                                                                                   |
| **`/ai-review`**                     | Commit/Push 前           | 本地並行啟動多子 Agent 從 Security, Correctness, Business, Performance 等維度進行無 API 金鑰消耗自檢。                                                                                  |
| **`/submit-pr`**                     | 功能開發完畢時           | 跑完編譯與所有單元測試 ➡️ 格式化 ➡️ 提交 Commit（自動關聯 #號）➡️ Push 並自動建立 PR。                                                                                                  |
| **`/migrate-to-shoehorn`**           | 測試 Mock 資料型別報錯時 | 一鍵將測試中不安全的 `as any` 斷言自動遷移成型別安全的「局部 Mock 語法」（免除手動補齊複雜型別中數十個無關欄位的痛苦）。                                                                |
| **`/improve-codebase-architecture`** | 欲優化專案架構時         | 深度掃描代碼庫並生成視覺化的 HTML 架構報告，找出模組深化（Deepening）與重構優化的黃金機會。                                                                                             |
| **`/to-spec`**                       | 方案討論完畢時           | 將對話上下文快速收斂成技術規格書（Spec）並發佈。                                                                                                                                        |
| **`/to-tickets`**                    | 動工前拆解任務時         | 將 Spec 依拓樸關係合理拆解為多個相依、有阻塞邊界（Blocked by）的 Tickets。                                                                                                              |
| **`/triage`**                        | 收到新 Issue/PR 時       | 進行重現驗證與分類（`ready-for-agent` / `ready-for-human`）。                                                                                                                           |

---

## 3. Matt Pocock 頂級工程規範 (Engineering Standards)

所有團隊成員與 AI 均須遵守以下核心指標：

1. **領域文檔優先 (`CONTEXT.md`)**：探索與開發前**必須**先閱讀根目錄的 `CONTEXT.md` 以對齊統一語言與術語，切勿隨意自創同義詞。
2. **架構決策追蹤 (`docs/adr/`)**：核心架構決策均寫於此。新代碼若與現有 ADR 衝突，須在 PR 中主動指出。
3. **深度模組封裝 (`Deep Modules`)**：具體實作細節隱藏在子目錄中，外部僅能透過 `index.ts` 導出，由 Dependency Cruiser 防禦架構邊界。
4. **測試拒絕 `as` 斷言**：嚴格禁止在測試資料中使用 `as any` 或 `as ComplexType`，請優先採用 `@total-typescript/shoehorn` 套件。
