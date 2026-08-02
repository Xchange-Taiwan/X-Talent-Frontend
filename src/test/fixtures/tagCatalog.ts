import type { IndustryOption, TagCatalogGroupVO } from '@/types/tagCatalog';

export const mockPositionGroups: TagCatalogGroupVO[] = [
  {
    subject_group: 'engineering',
    subject: '軟體工程',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 101,
        subject_group: 'frontend_developer',
        subject: '前端工程師',
        language: 'zh-TW',
      },
      {
        tag_id: 102,
        subject_group: 'backend_developer',
        subject: '後端工程師',
        language: 'zh-TW',
      },
      {
        tag_id: 103,
        subject_group: 'devops_engineer',
        subject: '雲端運維工程師',
        language: 'zh-TW',
      },
    ],
  },
  {
    subject_group: 'product_design',
    subject: '產品與設計',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 201,
        subject_group: 'product_manager',
        subject: '產品經理',
        language: 'zh-TW',
      },
      {
        tag_id: 202,
        subject_group: 'uiux_designer',
        subject: 'UI/UX 設計師',
        language: 'zh-TW',
      },
    ],
  },
  {
    subject_group: 'empty_group',
    subject: '空分類示範',
    language: 'zh-TW',
    leaves: [],
  },
];

export const mockSkillGroups: TagCatalogGroupVO[] = [
  {
    subject_group: 'programming_languages',
    subject: '程式語言',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 301,
        subject_group: 'javascript',
        subject: 'JavaScript',
        language: 'zh-TW',
      },
      {
        tag_id: 302,
        subject_group: 'typescript',
        subject: 'TypeScript',
        language: 'zh-TW',
      },
      {
        tag_id: 303,
        subject_group: 'python',
        subject: 'Python',
        language: 'zh-TW',
      },
      {
        tag_id: 304,
        subject_group: 'golang',
        subject: 'Go',
        language: 'zh-TW',
      },
    ],
  },
  {
    subject_group: 'frontend_frameworks',
    subject: '前端技術',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 401,
        subject_group: 'react',
        subject: 'React',
        language: 'zh-TW',
      },
      {
        tag_id: 402,
        subject_group: 'nextjs',
        subject: 'Next.js',
        language: 'zh-TW',
      },
      {
        tag_id: 403,
        subject_group: 'tailwindcss',
        subject: 'Tailwind CSS',
        language: 'zh-TW',
      },
    ],
  },
];

export const mockTopicGroups: TagCatalogGroupVO[] = [
  {
    subject_group: 'career_growth',
    subject: '職涯發展',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 501,
        subject_group: 'career_planning',
        subject: '職涯規劃',
        language: 'zh-TW',
      },
      {
        tag_id: 502,
        subject_group: 'resume_review',
        subject: '履歷健檢',
        language: 'zh-TW',
      },
      {
        tag_id: 503,
        subject_group: 'mock_interview',
        subject: '模擬面試',
        language: 'zh-TW',
      },
    ],
  },
  {
    subject_group: 'soft_skills',
    subject: '軟實力',
    language: 'zh-TW',
    leaves: [
      {
        tag_id: 601,
        subject_group: 'communication',
        subject: '溝通協調',
        language: 'zh-TW',
      },
      {
        tag_id: 602,
        subject_group: 'leadership',
        subject: '領導力',
        language: 'zh-TW',
      },
    ],
  },
];

export const mockIndustryOptions: IndustryOption[] = [
  {
    subject_group: 'tech_software',
    subject: '科技 / 軟體 / 半導體',
  },
  {
    subject_group: 'finance_insurance',
    subject: '金融 / 保險',
  },
  {
    subject_group: 'advertising_marketing',
    subject: '廣告 / 行銷 / 公關',
  },
];
