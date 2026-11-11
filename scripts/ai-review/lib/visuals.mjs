import fs from 'node:fs';
import path from 'node:path';

import { sniffImageMimeType } from '../../prefetch-ticket-visuals.mjs';

const MAX_INLINE_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB total base64 budget
const MAX_REF_IMAGES = 4;
const MAX_EVIDENCE_IMAGES = 4;

function readVerifiedImagesFromDir(dirPath, maxCount, labelPrefix) {
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  const entries = fs
    .readdirSync(dirPath)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
    .sort()
    .slice(0, maxCount);

  const items = [];
  for (const fileName of entries) {
    try {
      const fullPath = path.join(dirPath, fileName);
      const buf = fs.readFileSync(fullPath);
      const sniffed = sniffImageMimeType(buf);
      if (!sniffed) continue;
      items.push({
        fileName,
        path: fullPath.replace(/\\/g, '/'),
        mimeType: sniffed.mimeType,
        bytes: buf.length,
        base64Data: buf.toString('base64'),
        label: `${labelPrefix}: ${fileName}`,
      });
    } catch {
      // Skip unreadable files
    }
  }
  return items;
}

/**
 * Loads both Ticket/Design Hub visual references (`.agents/tmp/ticket-images`)
 * and Playwright-captured UI evidence screenshots (`.agents/tmp/evidence`)
 * for multimodal Gemini pre-PR verification.
 */
export function loadReviewVisualAssets({
  ticketImagesDir = '.agents/tmp/ticket-images',
  evidenceDir = '.agents/tmp/evidence',
} = {}) {
  const refCandidates = readVerifiedImagesFromDir(
    ticketImagesDir,
    MAX_REF_IMAGES,
    'Ticket/DesignHub 設計參考圖'
  );
  const evidenceCandidates = readVerifiedImagesFromDir(
    evidenceDir,
    MAX_EVIDENCE_IMAGES,
    '實作後 Playwright 實際截圖證據'
  );

  const selectedImages = [];
  let usedBytes = 0;

  for (const img of [...refCandidates, ...evidenceCandidates]) {
    if (usedBytes + img.bytes > MAX_INLINE_TOTAL_BYTES) continue;
    usedBytes += img.bytes;
    selectedImages.push({
      mimeType: img.mimeType,
      base64Data: img.base64Data,
      label: img.label,
      path: img.path,
    });
  }

  const hasRef = refCandidates.length > 0;
  const hasEvidence = evidenceCandidates.length > 0;

  const noteLines = [];
  if (hasRef || hasEvidence) {
    noteLines.push(
      '',
      '## 多模態視覺審查附件說明（Multimodal Visual Attachments）'
    );
    if (hasRef) {
      noteLines.push(
        `- 已附上 ${refCandidates.length} 張 Ticket／Design Hub 原始設計參考圖（標記為 \`Ticket/DesignHub 設計參考圖\`），請直接以視覺比對實作欄位、排版與文案是否對齊設計圖。`
      );
    }
    if (hasEvidence) {
      noteLines.push(
        `- 已附上 ${evidenceCandidates.length} 張本輪 Playwright 實際擷取的 UI 證據截圖（標記為 \`實作後 Playwright 實際截圖證據\`）：`,
        '  1. 請檢查截圖是否**真正打開並呈現本次修改的目標元件／狀態**（例如：改通知彈窗就必須點開通知鈴鐺拍出彈窗內容，絕不可只拍未點開的首頁；改評價 Tab 就必須拍出切換至該 Tab 的畫面）。',
        '  2. 請檢查截圖是否**已完成頁面初始化**（不可停留在 Skeleton 骨架屏、`載入中...`、破圖或 `□□□□` 中文字體方塊亂碼）。',
        '  3. 若截圖未打開目標功能或尚未載入完成，請回報明確 Finding 要求在對應 E2E `.spec.ts` 補齊互動點擊與等待後再呼叫 `captureEvidence(...)`。'
      );
    }
  }

  return {
    images: selectedImages,
    refCount: refCandidates.length,
    evidenceCount: evidenceCandidates.length,
    visualContextMarkdown: noteLines.join('\n'),
  };
}
