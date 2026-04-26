'use client';

import * as React from 'react';

import {
  Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';

const industryCategories: Category[] = [
  {
    key: 'all',
    label: '全部',
    options: [
      { value: 'ind_tech', label: '電子資訊 / 軟體 / 半導體相關業' },
      { value: 'ind_pro', label: '法律 / 會計 / 顧問 / 研發 / 設計業' },
      { value: 'ind_finance', label: '金融投顧及保險業' },
      { value: 'ind_realestate', label: '建築工程、空間設計與不動產業' },
      { value: 'ind_media', label: '大眾傳播相關業' },
      { value: 'ind_health', label: '醫療保健及環境衛生業' },
      { value: 'ind_travel', label: '旅遊 / 休閒 / 運動業' },
      { value: 'ind_service', label: '一般服務業' },
      { value: 'ind_retail', label: '批發 / 零售 / 傳直銷業' },
      { value: 'ind_edu', label: '文教相關業' },
      { value: 'ind_manufacturing', label: '一般製造業' },
      { value: 'ind_agri', label: '農林漁牧水電資源業' },
      { value: 'ind_logistics', label: '運輸物流及倉儲' },
      { value: 'ind_public', label: '政治宗教及社福相關業' },
      { value: 'ind_mining', label: '礦業及土石採取業' },
      { value: 'ind_hospitality', label: '住宿 / 餐飲服務業' },
    ],
  },
];

const positionCategories: Category[] = [
  {
    key: 'pos_software',
    label: '軟體開發',
    options: [
      { value: 'pos_fe', label: '前端工程師' },
      { value: 'pos_be', label: '後端工程師' },
      { value: 'pos_fullstack', label: '全端工程師' },
      { value: 'pos_android', label: 'Android 工程師' },
      { value: 'pos_ios', label: 'iOS 工程師' },
      { value: 'pos_qa', label: '測試工程師' },
      { value: 'pos_db', label: '資料庫工程師' },
      { value: 'pos_devops', label: 'DevOps / SRE' },
      { value: 'pos_data_analyst', label: '資料分析師' },
      { value: 'pos_algo', label: '演算法工程師' },
      { value: 'pos_ai', label: 'AI 工程師' },
      { value: 'pos_sa', label: '系統分析師' },
      { value: 'pos_arch', label: '系統架構師' },
      { value: 'pos_mis', label: 'MIS 工程師' },
      { value: 'pos_security', label: '資安工程師' },
    ],
  },
  {
    key: 'pos_product_design',
    label: '產品設計',
    options: [
      { value: 'pos_pjm', label: '專案經理' },
      { value: 'pos_pm', label: '產品經理' },
      { value: 'pos_research', label: '產品研究員' },
      { value: 'pos_uiux', label: 'UIUX 設計師' },
      { value: 'pos_visual', label: '視覺設計師' },
      { value: 'pos_motion', label: '動畫設計師' },
      { value: 'pos_packaging', label: '包裝設計師' },
    ],
  },
  {
    key: 'pos_marketing',
    label: '行銷企劃',
    options: [
      { value: 'pos_social_mkt', label: '社群行銷' },
      { value: 'pos_ad_creative', label: '廣告創意' },
      { value: 'pos_video', label: '影音製作' },
      { value: 'pos_pr', label: '媒體公關' },
      { value: 'pos_event', label: '活動企劃' },
      { value: 'pos_web_planning', label: '網站企劃' },
    ],
  },
  {
    key: 'pos_admin',
    label: '行政營運',
    options: [
      { value: 'pos_hr', label: '人力資源' },
      { value: 'pos_edu_agent', label: '教育仲介' },
      { value: 'pos_admin', label: '行政文書' },
      { value: 'pos_legal', label: '法務專利' },
      { value: 'pos_accounting', label: '財務會計' },
    ],
  },
  {
    key: 'pos_customer',
    label: '客服業務',
    options: [
      { value: 'pos_account_mgr', label: '客戶經理' },
      { value: 'pos_biz_dev', label: '業務拓展' },
      { value: 'pos_trade', label: '國際貿易' },
      { value: 'pos_consultant', label: '管理顧問' },
    ],
  },
  {
    key: 'pos_finance',
    label: '財務金融',
    options: [
      { value: 'pos_wealth', label: '理財專員' },
      { value: 'pos_invest', label: '投資經理' },
      { value: 'pos_trader', label: '金融交易' },
    ],
  },
];

const skillCategories: Category[] = [
  {
    key: 'skill_strategy',
    label: '商業策略',
    options: [
      { value: 'skill_market_analysis', label: '市場分析' },
      { value: 'skill_business_model', label: '商業模式' },
      { value: 'skill_gtm', label: 'GTM 策略' },
    ],
  },
  {
    key: 'skill_product',
    label: '產品管理',
    options: [
      { value: 'skill_product_planning', label: '產品規劃' },
      { value: 'skill_requirement', label: '需求分析' },
      { value: 'skill_data_analysis', label: '數據分析' },
      { value: 'skill_pm', label: '專案管理' },
      { value: 'skill_stakeholder', label: '利害關係人管理' },
      { value: 'skill_user_interview', label: '使用者訪談' },
      { value: 'skill_competitor', label: '競品分析' },
    ],
  },
  {
    key: 'skill_software',
    label: '軟體開發',
    options: [
      { value: 'skill_ios', label: 'iOS 開發' },
      { value: 'skill_android', label: 'Android 開發' },
      { value: 'skill_frontend', label: '前端開發' },
      { value: 'skill_backend', label: '後端開發' },
      { value: 'skill_perf', label: '系統效能' },
      { value: 'skill_test_auto', label: '自動化測試' },
      { value: 'skill_ai_coding', label: 'AI Coding' },
    ],
  },
  {
    key: 'skill_design',
    label: '介面設計',
    options: [
      { value: 'skill_interaction', label: '介面互動' },
      { value: 'skill_visual', label: '視覺設計' },
      { value: 'skill_prototyping', label: '原型製作' },
    ],
  },
  {
    key: 'skill_marketing',
    label: '社群行銷',
    options: [
      { value: 'skill_seo_sem', label: 'SEO / SEM' },
      { value: 'skill_ad', label: '廣告投放' },
      { value: 'skill_funnel', label: '行銷漏斗' },
      { value: 'skill_brand', label: '品牌行銷' },
      { value: 'skill_growth', label: '增長駭客' },
      { value: 'skill_short_video', label: '短影音製作' },
      { value: 'skill_community', label: '社群經營' },
      { value: 'skill_copywriting', label: '文案撰寫' },
      { value: 'skill_personal_brand', label: '個人品牌' },
      { value: 'skill_kol', label: 'KOL 合作' },
    ],
  },
  {
    key: 'skill_business_dev',
    label: '業務拓展',
    options: [
      { value: 'skill_cold_call', label: '陌生開發' },
      { value: 'skill_overseas', label: '海外拓展' },
      { value: 'skill_intl_trade', label: '國際貿易' },
    ],
  },
];

const topicCategories: Category[] = [
  {
    key: 'topic_jobseeking',
    label: '求職技能發展',
    options: [
      { value: 'topic_salary_negotiation', label: '薪資談判方式' },
      { value: 'topic_interview', label: '面試說話技巧' },
      { value: 'topic_portfolio', label: '求職作品指導' },
    ],
  },
  {
    key: 'topic_workplace',
    label: '職場實戰工作',
    options: [
      { value: 'topic_company_culture', label: '公司部門文化' },
      { value: 'topic_promotion', label: '升遷考核制度' },
      { value: 'topic_cross_team', label: '跨組溝通協作' },
      { value: 'topic_managing_up', label: '向上管理回報' },
      { value: 'topic_leadership', label: '團隊領導方式' },
      { value: 'topic_remote_work', label: '遠端工作心得' },
      { value: 'topic_overseas_career', label: '海外求職經驗' },
      { value: 'topic_certification', label: '證照考取建議' },
      { value: 'topic_pm_practice', label: '專案管理實務' },
    ],
  },
  {
    key: 'topic_personal_growth',
    label: '個人生活成長',
    options: [
      { value: 'topic_work_life', label: '工作生活平衡' },
      { value: 'topic_personal_brand', label: '個人品牌經營' },
      { value: 'topic_career_transition', label: '未來轉職規劃' },
    ],
  },
];

interface VariantProps {
  title: string;
  description: string;
  initialValue: string[];
  categories: Category[];
  maxSelected?: number;
  emptyText?: string;
  flat?: boolean;
}

function Variant({
  title,
  description,
  initialValue,
  categories,
  maxSelected = 10,
  emptyText,
  flat,
}: VariantProps): React.ReactElement {
  const [value, setValue] = React.useState<string[]>(initialValue);
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-sm text-text-tertiary">{description}</p>
      </header>
      <div className="w-[420px] max-w-full">
        <CategoryMultiSelect
          categories={categories}
          flat={flat}
          value={value}
          onChange={setValue}
          maxSelected={maxSelected}
          emptyText={emptyText}
        />
      </div>
      <p className="text-xs text-text-tertiary">
        目前選到的 value：
        <code className="ml-1 rounded bg-background-top px-1.5 py-0.5">
          {JSON.stringify(value)}
        </code>
      </p>
    </section>
  );
}

export default function CategoryMultiSelectPreviewPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          CategoryMultiSelect — 預覽
        </h1>
        <p className="mt-2 text-sm text-text-tertiary">
          設計來源：X-Talent-Tracker issue #108。兩層 list + 搜尋 + 數量上限。
          這個頁面是 review 用，併 PR 前會刪除。
        </p>
      </header>

      <div className="grid gap-12">
        <Variant
          title="產業（單層 list）"
          description="共 16 項，沒有分類，flat 模式：搜尋 + checkbox 直接列出。上限 10。"
          initialValue={[]}
          categories={industryCategories}
          flat
        />

        <Variant
          title="職位（6 個分類）"
          description="軟體開發 / 產品設計 / 行銷企劃 / 行政營運 / 客服業務 / 財務金融。上限 10。"
          initialValue={['pos_fe', 'pos_pm']}
          categories={positionCategories}
        />

        <Variant
          title="技能（6 個分類）"
          description="商業策略 / 產品管理 / 軟體開發 / 介面設計 / 社群行銷 / 業務拓展。上限 10。"
          initialValue={['skill_market_analysis', 'skill_pm']}
          categories={skillCategories}
        />

        <Variant
          title="主題（3 個分類）"
          description="求職 / 職場 / 自我成長。分組方式由我建議，請確認。上限 10。"
          initialValue={[]}
          categories={topicCategories}
        />

        <Variant
          title="技能 — 達上限"
          description="選滿 10 個，未勾選 row 整列灰掉並 disable，底部計數變紅字。"
          initialValue={[
            'skill_market_analysis',
            'skill_business_model',
            'skill_gtm',
            'skill_product_planning',
            'skill_requirement',
            'skill_data_analysis',
            'skill_pm',
            'skill_stakeholder',
            'skill_user_interview',
            'skill_competitor',
          ]}
          categories={skillCategories}
        />

        <Variant
          title="技能 — 上限 3 個"
          description="方便快速感受 disable 視覺。"
          initialValue={['skill_market_analysis', 'skill_pm', 'skill_seo_sem']}
          categories={skillCategories}
          maxSelected={3}
        />
      </div>
    </div>
  );
}
