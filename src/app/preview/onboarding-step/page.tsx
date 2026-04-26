'use client';

import {
  Award,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  FileText,
  Globe,
  ListChecks,
  type LucideIcon,
  MessageCircle,
  Mic,
  Scale,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wifi,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const industryCategories: Category[] = [
  {
    key: 'industry_all',
    label: '產業',
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

const locationOptions = [
  { value: 'TW', label: '台灣' },
  { value: 'JP', label: '日本' },
  { value: 'US', label: '美國' },
  { value: 'GB', label: '英國' },
  { value: 'SG', label: '新加坡' },
  { value: 'HK', label: '香港' },
  { value: 'CN', label: '中國' },
  { value: 'CA', label: '加拿大' },
  { value: 'AU', label: '澳洲' },
  { value: 'DE', label: '德國' },
];

const experienceOptions = [
  { value: '0_1', label: '1 年以下' },
  { value: '1_3', label: '1 - 3 年' },
  { value: '3_5', label: '3 - 5 年' },
  { value: '5_10', label: '5 - 10 年' },
  { value: '10_plus', label: '10 年以上' },
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

interface RichOption {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

interface RichCategory {
  key: string;
  label: string;
  options: RichOption[];
}

const topicRichCategories: RichCategory[] = [
  {
    key: 'topic_jobseeking',
    label: '求職技能發展',
    options: [
      {
        value: 'topic_salary_negotiation',
        label: '薪資談判方式',
        description: '在不同階段爭取最佳薪資與福利的策略。',
        icon: Coins,
      },
      {
        value: 'topic_interview',
        label: '面試說話技巧',
        description: '面試溝通與表達的實戰技巧。',
        icon: Mic,
      },
      {
        value: 'topic_portfolio',
        label: '求職作品指導',
        description: '履歷與作品集的優化建議。',
        icon: FileText,
      },
    ],
  },
  {
    key: 'topic_workplace',
    label: '職場實戰工作',
    options: [
      {
        value: 'topic_company_culture',
        label: '公司部門文化',
        description: '不同公司與部門的文化差異。',
        icon: Building2,
      },
      {
        value: 'topic_promotion',
        label: '升遷考核制度',
        description: '各家公司升遷標準與評估方式。',
        icon: TrendingUp,
      },
      {
        value: 'topic_cross_team',
        label: '跨組溝通協作',
        description: '跨部門合作的溝通技巧。',
        icon: Users,
      },
      {
        value: 'topic_managing_up',
        label: '向上管理回報',
        description: '與主管有效溝通與回報的方法。',
        icon: MessageCircle,
      },
      {
        value: 'topic_leadership',
        label: '團隊領導方式',
        description: '領導與帶人的實戰經驗分享。',
        icon: Crown,
      },
      {
        value: 'topic_remote_work',
        label: '遠端工作心得',
        description: '遠距工作的工具與心法。',
        icon: Wifi,
      },
      {
        value: 'topic_overseas_career',
        label: '海外求職經驗',
        description: '海外求職的準備與實戰心得。',
        icon: Globe,
      },
      {
        value: 'topic_certification',
        label: '證照考取建議',
        description: '熱門證照的評估與準備。',
        icon: Award,
      },
      {
        value: 'topic_pm_practice',
        label: '專案管理實務',
        description: '專案管理的工具與流程。',
        icon: ListChecks,
      },
    ],
  },
  {
    key: 'topic_personal_growth',
    label: '個人生活成長',
    options: [
      {
        value: 'topic_work_life',
        label: '工作生活平衡',
        description: '工作與生活的平衡之道。',
        icon: Scale,
      },
      {
        value: 'topic_personal_brand',
        label: '個人品牌經營',
        description: 'LinkedIn 與個人形象的經營建議。',
        icon: Star,
      },
      {
        value: 'topic_career_transition',
        label: '未來轉職規劃',
        description: '長期職涯規劃與轉職策略。',
        icon: Compass,
      },
    ],
  },
];

interface StepConfig {
  step: number;
  total: number;
  title: string;
  categories: Category[];
  rich?: RichCategory[];
  popular: string[];
  initialValue: string[];
}

const STEPS: Record<3 | 4 | 5, StepConfig> = {
  3: {
    step: 3,
    total: 5,
    title: '有興趣多了解的職位',
    categories: positionCategories,
    popular: [
      'pos_fe',
      'pos_be',
      'pos_pm',
      'pos_uiux',
      'pos_data_analyst',
      'pos_ai',
    ],
    initialValue: ['pos_fe', 'pos_pm'],
  },
  4: {
    step: 4,
    total: 5,
    title: '想多了解、加強的技能',
    categories: skillCategories,
    popular: [
      'skill_pm',
      'skill_data_analysis',
      'skill_frontend',
      'skill_backend',
      'skill_brand',
      'skill_user_interview',
    ],
    initialValue: ['skill_pm', 'skill_data_analysis'],
  },
  5: {
    step: 5,
    total: 5,
    title: '想多了解的主題',
    categories: topicCategories,
    rich: topicRichCategories,
    popular: [
      'topic_interview',
      'topic_salary_negotiation',
      'topic_portfolio',
      'topic_work_life',
      'topic_career_transition',
      'topic_personal_brand',
    ],
    initialValue: ['topic_interview', 'topic_portfolio'],
  },
};

function StepHeader({
  step,
  total,
  title,
  hint,
}: {
  step: number;
  total: number;
  title: string;
  hint?: string;
}): React.ReactElement {
  return (
    <div>
      <p className="mb-4 text-base font-semibold text-text-tertiary">
        步驟 {step} / {total}
      </p>
      <div className="flex items-center gap-3">
        <ChevronLeft className="h-6 w-6 cursor-pointer" />
        <p className="text-4xl font-bold text-text-primary">{title}</p>
      </div>
      {hint && <p className="ml-9 mt-2 text-sm text-text-tertiary">{hint}</p>}
    </div>
  );
}

function Step2Preview(): React.ReactElement {
  const [location, setLocation] = React.useState<string>('');
  const [experience, setExperience] = React.useState<string>('');
  const [industries, setIndustries] = React.useState<string[]>([]);
  const canSubmit = Boolean(location && experience);

  return (
    <div className="space-y-10">
      <StepHeader
        step={2}
        total={5}
        title="個人資訊"
        hint="地區與經驗保持單選 dropdown，產業改成多選兩層（issue #108 範圍）。"
      />

      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">地區</label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger>
              <SelectValue placeholder="請填入您的所在地區" />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">經驗</label>
          <Select value={experience} onValueChange={setExperience}>
            <SelectTrigger>
              <SelectValue placeholder="請選擇您的年資區間" />
            </SelectTrigger>
            <SelectContent>
              {experienceOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            產業 <span className="text-text-tertiary">(選填，最多 10 個)</span>
          </label>
          <CategoryMultiSelect
            categories={industryCategories}
            flat
            value={industries}
            onChange={setIndustries}
            maxSelected={10}
          />
        </div>
      </div>

      <Button className="rounded-xl px-12" disabled={!canSubmit}>
        下一步
      </Button>
    </div>
  );
}

function OptionA({ config }: { config: StepConfig }): React.ReactElement {
  const [value, setValue] = React.useState<string[]>(config.initialValue);
  return (
    <div className="space-y-10">
      <StepHeader
        step={config.step}
        total={config.total}
        title={config.title}
        hint="從分類展開挑選，最多 10 個。"
      />
      <CategoryMultiSelect
        categories={config.categories}
        value={value}
        onChange={setValue}
        maxSelected={10}
      />
      <Button className="rounded-xl px-12" disabled={value.length === 0}>
        下一步
      </Button>
    </div>
  );
}

function OptionB({ config }: { config: StepConfig }): React.ReactElement {
  const allOptions = React.useMemo(
    () => config.categories.flatMap((c) => c.options),
    [config]
  );
  const [value, setValue] = React.useState<string[]>(config.initialValue);
  const [showAll, setShowAll] = React.useState(false);
  const popular = allOptions.filter((o) => config.popular.includes(o.value));
  const limitReached = value.length >= 10;

  const togglePopular = (v: string): void => {
    if (value.includes(v)) {
      setValue(value.filter((x) => x !== v));
    } else if (!limitReached) {
      setValue([...value, v]);
    }
  };

  return (
    <div className="space-y-10">
      <StepHeader
        step={config.step}
        total={config.total}
        title={config.title}
        hint="先從熱門挑，或展開看完整清單。最多 10 個。"
      />

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-text-primary">熱門選項</h3>
        <div className="flex flex-wrap gap-3">
          {popular.map((opt) => {
            const checked = value.includes(opt.value);
            const disabled = !checked && limitReached;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => togglePopular(opt.value)}
                disabled={disabled}
                className={
                  'rounded-xl border px-3 py-2 text-sm transition ' +
                  (checked
                    ? 'border-primary bg-secondary text-text-primary'
                    : disabled
                      ? 'cursor-not-allowed border-gray-200 text-text-disable'
                      : 'border-gray-200 text-text-primary hover:border-primary')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          {showAll ? '收起完整分類' : '查看全部分類 →'}
        </button>
      </section>

      {showAll && (
        <CategoryMultiSelect
          categories={config.categories}
          value={value}
          onChange={setValue}
          maxSelected={10}
        />
      )}

      <Button className="rounded-xl px-12" disabled={value.length === 0}>
        下一步
      </Button>
    </div>
  );
}

function OptionC({ config }: { config: StepConfig }): React.ReactElement {
  const [value, setValue] = React.useState<string[]>(config.initialValue);
  const limitReached = value.length >= 10;
  const selectedSet = new Set(value);

  const toggle = (v: string): void => {
    if (selectedSet.has(v)) {
      setValue(value.filter((x) => x !== v));
    } else if (!limitReached) {
      setValue([...value, v]);
    }
  };

  return (
    <div className="space-y-10 pb-24">
      <StepHeader
        step={config.step}
        total={config.total}
        title={config.title}
        hint="按分類展開，每類就在原位置勾選。最多 10 個。"
      />

      <div className="space-y-8">
        {config.categories.map((cat) => {
          const selectedInCat = cat.options.filter((o) =>
            selectedSet.has(o.value)
          ).length;
          return (
            <section key={cat.key} className="space-y-3">
              <header className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  {cat.label}
                </h3>
                <span className="text-sm tabular-nums text-text-tertiary">
                  {selectedInCat} / {cat.options.length}
                </span>
              </header>
              <div className="flex flex-wrap gap-2">
                {cat.options.map((opt) => {
                  const checked = selectedSet.has(opt.value);
                  const disabled = !checked && limitReached;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => toggle(opt.value)}
                      disabled={disabled}
                      className={
                        'rounded-full border px-3 py-1.5 text-sm transition ' +
                        (checked
                          ? 'border-primary bg-secondary text-text-primary'
                          : disabled
                            ? 'cursor-not-allowed border-gray-200 text-text-disable'
                            : 'border-gray-200 text-text-primary hover:border-primary')
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-background-border bg-background-white px-5 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-[600px] items-center justify-between">
          <span
            className={
              'text-sm tabular-nums ' +
              (limitReached ? 'text-status-200' : 'text-text-tertiary')
            }
          >
            已選 {value.length} / 10
          </span>
          <Button className="rounded-xl px-12" disabled={value.length === 0}>
            下一步
          </Button>
        </div>
      </div>
    </div>
  );
}

function OptionD({ config }: { config: StepConfig }): React.ReactElement {
  const richCategories: RichCategory[] = React.useMemo(() => {
    if (config.rich) return config.rich;
    return config.categories.map((c) => ({
      key: c.key,
      label: c.label,
      options: c.options.map((o) => ({ value: o.value, label: o.label })),
    }));
  }, [config]);

  const [value, setValue] = React.useState<string[]>(config.initialValue);
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(richCategories.map((c) => [c.key, true]))
  );
  const limitReached = value.length >= 10;
  const selectedSet = new Set(value);

  const toggleOption = (v: string): void => {
    if (selectedSet.has(v)) {
      setValue(value.filter((x) => x !== v));
    } else if (!limitReached) {
      setValue([...value, v]);
    }
  };

  const toggleSection = (key: string): void => {
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const layoutClass =
    config.step === 4
      ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
      : config.step === 3
        ? 'flex flex-wrap gap-3'
        : 'grid grid-cols-1 gap-3';

  const renderItem = (opt: RichOption): React.ReactElement => {
    const checked = selectedSet.has(opt.value);
    const disabled = !checked && limitReached;

    if (config.step === 3) {
      return (
        <button
          type="button"
          key={opt.value}
          onClick={() => toggleOption(opt.value)}
          disabled={disabled}
          className={cn(
            'rounded-xl border px-3 py-2 text-sm transition',
            checked
              ? 'border-primary bg-secondary text-text-primary'
              : 'border-gray-200 text-text-primary hover:border-primary',
            disabled && 'cursor-not-allowed opacity-50 hover:border-gray-200'
          )}
        >
          {opt.label}
        </button>
      );
    }

    if (config.step === 4) {
      return (
        <label
          key={opt.value}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3',
            checked ? 'border-primary bg-secondary' : 'border-gray-200',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => toggleOption(opt.value)}
          />
          <span className="text-base text-text-primary">{opt.label}</span>
        </label>
      );
    }

    const Icon = opt.icon ?? Sparkles;
    return (
      <label
        key={opt.value}
        className={cn(
          'flex cursor-pointer items-start gap-4 rounded-xl border px-4 py-3',
          checked ? 'border-primary bg-secondary' : 'border-gray-200',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <div className="rounded-full bg-brand-50 p-3">
          <Icon className="h-6 w-6 text-brand-700" />
        </div>
        <div className="grow">
          <p className="text-base font-medium text-text-primary">{opt.label}</p>
          {opt.description && (
            <p className="text-sm text-text-tertiary">{opt.description}</p>
          )}
        </div>
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={() => toggleOption(opt.value)}
          className="mt-1"
        />
      </label>
    );
  };

  const hint =
    config.step === 5
      ? '按分類展開，每個項目附 icon 與描述。最多 10 個。'
      : config.step === 4
        ? '保留 2 欄 card 樣式，按分類展開挑選。最多 10 個。'
        : '保留 chip 樣式，按分類展開挑選。最多 10 個。';

  return (
    <div className="space-y-10 pb-24">
      <StepHeader
        step={config.step}
        total={config.total}
        title={config.title}
        hint={hint}
      />

      <div className="space-y-6">
        {richCategories.map((cat) => {
          const open = openMap[cat.key];
          const selectedInCat = cat.options.filter((o) =>
            selectedSet.has(o.value)
          ).length;
          return (
            <section key={cat.key} className="space-y-3">
              <button
                type="button"
                onClick={() => toggleSection(cat.key)}
                className="flex w-full items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  {open ? (
                    <ChevronDown className="h-5 w-5 text-text-secondary" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-text-secondary" />
                  )}
                  <h3 className="text-lg font-semibold text-text-primary">
                    {cat.label}
                  </h3>
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-sm tabular-nums',
                    selectedInCat > 0
                      ? 'bg-brand-100 text-brand-700'
                      : 'text-text-tertiary'
                  )}
                >
                  {selectedInCat} / {cat.options.length}
                </span>
              </button>

              {open && (
                <div className={layoutClass}>{cat.options.map(renderItem)}</div>
              )}
            </section>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-background-border bg-background-white px-5 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-[600px] items-center justify-between">
          <span
            className={cn(
              'text-sm tabular-nums',
              limitReached ? 'text-status-200' : 'text-text-tertiary'
            )}
          >
            已選 {value.length} / 10
          </span>
          <Button className="rounded-xl px-12" disabled={value.length === 0}>
            下一步
          </Button>
        </div>
      </div>
    </div>
  );
}

type Tab = 'a' | 'b' | 'c' | 'd';
type StepKey = 2 | 3 | 4 | 5;

export default function OnboardingStepPreviewPage(): React.ReactElement {
  const [tab, setTab] = React.useState<Tab>('a');
  const [stepKey, setStepKey] = React.useState<StepKey>(3);
  const stepLabels: Record<StepKey, string> = {
    2: '個人資訊',
    3: STEPS[3].title,
    4: STEPS[4].title,
    5: STEPS[5].title,
  };

  return (
    <div className="min-h-screen bg-background-bottom">
      <div className="mx-auto max-w-[600px] px-5 py-12">
        <div className="mb-6 rounded-2xl border border-background-border bg-background-white p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">
            選 step
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {([2, 3, 4, 5] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStepKey(s)}
                className={
                  'rounded-full border px-4 py-1.5 text-sm transition ' +
                  (stepKey === s
                    ? 'border-primary bg-secondary text-text-primary'
                    : 'border-gray-200 text-text-secondary hover:border-primary')
                }
              >
                Step {s} — {stepLabels[s]}
              </button>
            ))}
          </div>

          <p className="mb-3 text-sm font-semibold text-text-primary">
            選設計方案
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'a', label: 'A — 兩層 list（issue 設計）' },
                { id: 'b', label: 'B — 熱門 + 展開全部' },
                { id: 'c', label: 'C — 全展開 + sticky 底部' },
                { id: 'd', label: 'D — 原樣式 + 分類 sections' },
              ] as const
            ).map((opt) => {
              const disabled = stepKey === 2;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => !disabled && setTab(opt.id)}
                  disabled={disabled}
                  className={
                    'rounded-full border px-4 py-1.5 text-sm transition ' +
                    (disabled
                      ? 'cursor-not-allowed border-gray-200 text-text-disable'
                      : tab === opt.id
                        ? 'border-primary bg-secondary text-text-primary'
                        : 'border-gray-200 text-text-secondary hover:border-primary')
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            {stepKey === 2
              ? 'Step 2 只有「產業」一個多選欄位，方案 A/B/C/D 不適用 — 直接用 CategoryMultiSelect 嵌進表單即可。'
              : '這個切換器只在預覽頁出現，不是真的 onboarding UI 的一部分。'}
          </p>
        </div>

        <div className="rounded-2xl bg-background-white p-6">
          {stepKey === 2 ? (
            <Step2Preview />
          ) : (
            <>
              {tab === 'a' && <OptionA config={STEPS[stepKey]} />}
              {tab === 'b' && <OptionB config={STEPS[stepKey]} />}
              {tab === 'c' && <OptionC config={STEPS[stepKey]} />}
              {tab === 'd' && <OptionD config={STEPS[stepKey]} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
