'use client';

import { ExpertiseSelectItem } from '@/components/profile/ExpertiseSelectItem';
import { Button } from '@/components/ui/button';

const EXPERTISE_SELECTION = ['UI', 'UX', 'SEO', 'Graphic'] as const;

export default function Page() {
  // TODO: 需實作儲存邏輯，之後再來串 API，可以先在 LocalStorage 開一個欄位叫 expertise 來去存目前選到的 EXPERTISE_SELECTION 值

  return (
    <div>
      <h1>你的專長頁</h1>

      <div>
        {/* TODO: 依據 Array 來去 Render 選項，這邊先寫死，但之後會是 fetch 後端資料來，先保留彈性。 */}
        {EXPERTISE_SELECTION.map((type) => (
          <ExpertiseSelectItem key={type} type={type} />
        ))}
      </div>

      <div className="flex gap-4">
        <Button variant="outline">取消</Button>
        <Button variant="default">儲存</Button>
      </div>
    </div>
  );
}
