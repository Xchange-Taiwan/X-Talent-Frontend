# 色彩 Token 系統收斂與遷移計畫 (Color Token Convergence & Migration Plan)

本專案已完成「雙軌色彩 token 系統」在**定義層**的收斂工作（`src/design/tokens/color.ts` 為唯一來源）。**元件層**的遷移仍在進行中：截至目前僅 `src/components/ui/badge.tsx` 已改用新統一命名，其餘沿用 shadcn 語意 class（`bg-primary`、`border-border`、`bg-muted` 等）的元件仍待逐步遷移，尚未訂出具體時程（追蹤於 [X-Tracker #396](https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/396)）。兩套命名目前數值一致，暫不影響視覺表現。

以下為調整重點、現已完成的修改，以及後續基礎與業務元件的逐步遷移指引。

---

## 1. 架構調整與現狀 (What We Achieved)

### 1.1 唯一色彩 Token 來源 (Single Source of Truth)

我們已將 `./src/design/tokens/color.ts` 確立為全專案唯一的色彩 Token 定義檔。

- 所有的 **shadcn/ui 語意變數**（如 `primary`, `secondary`, `destructive`, `muted`, `border` 等）已全數併入 `src/design/tokens/color.ts` 統一管理。
- **`tailwind.config.js` 瘦身**：移除了 `extend.colors` 中與 `color.ts` 重複定義的冗餘區塊。現在 Tailwind 全部的色彩直接從 `colors` 模組載入，確保結構無重複維護問題。

### 1.2 清除 HSL 數值重複 (Eliminated Duplicate CSS Variables)

在 `src/styles/global.css` 中，我們重構了 `:root` 宣告：

- 移除了 legacy / shadcn 變數中硬編碼的 HSL 數值（如 `--primary: 180 64% 48%` 與 `--color-brand-500: 180 64% 48%` 的重疊維護）。
- **變數映射（Alias-based mapping）**：現在所有的 shadcn 變數直接以 `var()` 映射至自訂的 Color System Tokens。例如：
  - `--primary: var(--color-brand-500);`
  - `--secondary: var(--color-background-bottom);`
  - `--border: var(--color-background-border);`
- 這意謂著：即使舊元件或第三方套件仍在使用 `bg-primary` 或 `border-border`，其底層數值也已 100% 同步於自訂色彩系統，達成了數值層面的完全收斂。

---

## 2. 遷移映射表 (Tailwind Class Mapping Table)

在後續的元件開發與重構中，請依照下表逐步將 legacy/shadcn 語意類名替換為統一說明的設計系統類名：

| 舊語意類名 (Legacy Class Name)                        | 新統一系統類名 (Unified Class Name) | 對應說明 (Description)       |
| :---------------------------------------------------- | :---------------------------------- | :--------------------------- |
| `bg-primary`, `text-primary`                          | `bg-brand-500`, `text-brand-500`    | 品牌色（亮青色 Teal）        |
| `text-primary-foreground`                             | `text-text-primary`                 | 品牌色上的高對比深灰文字色   |
| `bg-secondary`, `bg-accent`                           | `bg-background-bottom`              | 次要背景色 / 卡片底色        |
| `text-secondary-foreground`, `text-accent-foreground` | `text-text-primary`                 | 次要色上的主要文字色         |
| `bg-muted`                                            | `bg-background-bottom`              | 靜態、被動或失效狀態底色     |
| `text-muted-foreground`                               | `text-text-tertiary`                | 輔助/說明文字色（灰色）      |
| `bg-destructive`                                      | `bg-status-error-default`           | 警告/危險/刪除狀態色（紅色） |
| `text-destructive-foreground`                         | `text-text-white`                   | 警告狀態底下的白色文字       |
| `border-border`, `border-input`                       | `border-background-border`          | 基礎框線 / 輸入框框線色      |
| `bg-background`                                       | `bg-background-white`               | 頂層最亮主背景色（白色）     |

---

## 3. 基礎元件遷移範例 (Migration Example)

我們已將 `src/components/ui/badge.tsx` 作為首個遷移範例，程式碼調整對比如下：

### 調整前 (Before)

```tsx
const badgeVariants = cva(
  'inline-flex items-center rounded-lg border ...',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        filter:
          'py-1.5 pr-2 pl-3 h-8 border border-background-border rounded-lg gap-2 hover:bg-background-bottom-secondary transition-colors',
      },
    },
    ...
  }
);
```

### 調整後 (After)

```tsx
const badgeVariants = cva(
  'inline-flex items-center rounded-lg border ...',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-brand-500 text-text-primary hover:bg-brand-500/80',
        secondary:
          'border-transparent bg-background-bottom text-text-primary hover:bg-background-bottom/80',
        destructive:
          'border-transparent bg-status-error-default text-text-white hover:bg-status-error-default/80',
        outline: 'text-text-primary',
        filter:
          'py-1.5 pr-2 pl-3 h-8 border border-background-border rounded-lg gap-2 hover:bg-background-bottom-secondary transition-colors',
      },
    },
    ...
  }
);
```

---

## 4. 前端開發規範 (Developer Guidelines)

1. **嚴禁新增硬編碼數值**：任何色彩設定，不論是在 `.css` 還是 Tailwind class 中，均不得使用自訂的十六進位（Hex）或 RGB 數值。
2. **優先使用系統類名**：新開發之業務元件（如：profile, reservation, mentor-pool）與自訂元件，請一律優先採用 `text-text-primary`, `bg-brand-500`, `border-background-border` 等命名。
3. **逐步完成 `src/components/ui` 遷移**：當前基礎元件在映射後雖然視覺表現已對齊，但在下一次對該元件進行修改/重構時，請順手將其 Tailwind 類名改寫為新統一系統命名。

---

## 5. 待 Design 確認事項 (Pending Design Confirmation)

以下項目數值/決策尚未經 Design 正式確認，追蹤於 [X-Tracker #396](https://github.com/Xchange-Taiwan/X-Talent-Tracker/issues/396)，請勿在確認前逕自合併或修改：

- `--color-background-top` 與 `--color-background-bottom` 目前數值相同（`0 0% 96%`），`--color-background-top-active` 與 `--color-background-border` 也相同（`210 9% 91%`）。待確認是否為刻意共用（可合併）或巧合（應保留獨立 token）。
- `--color-gray-50`（`global.css`）目前為內插推算值（`0 0% 97%` / #F7F7F7），非 Figma 正式數值，待 Design 提供確認值。
