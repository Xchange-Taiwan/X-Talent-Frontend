import type { Meta, StoryObj } from '@storybook/nextjs';

import defaultAvatar from '@/assets/default-avatar.png';
import { MentorType } from '@/services/search-mentor/mentors';

import { MentorCardList } from './index';

const mockMentors: MentorType[] = [
  {
    user_id: 1,
    name: '陳怡君 (Jane Chen)',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    job_title: 'Senior UI/UX Designer',
    company: 'Google',
    years_of_experience: 'THREE_TO_FIVE',
    location: '台北市',
    personal_statement: '用設計拉近人與科技的距離，創造溫度的產品體驗。',
    about:
      '擁有 8 年以上數位產品設計經驗，曾主導多個跨國 B2B 與 B2C 產品的設計與優化。熱衷於使用者研究、資訊架構與互動設計。',
    seniority_level: 'Senior',
    industry: 'Internet / Software',
    want_position: ['Product Designer', 'UI/UX Designer'],
    want_skill: ['Figma', 'User Research', 'Design System'],
    want_topic: ['設計職涯規劃', '履歷與作品集健檢'],
    have_skill: ['Figma', 'Prototyping', 'User Interview', 'Wireframing'],
    have_topic: [
      'UI/UX 設計',
      '使用者研究',
      '產品規劃',
      '職涯諮詢',
      '求職履歷優化',
    ],
    updated_at: 1722240000,
  },
  {
    user_id: 2,
    name: '王小明 (John Wang)',
    avatar: defaultAvatar,
    job_title: 'Senior Frontend Engineer',
    company: 'TSMC',
    years_of_experience: 'FIVE_TO_TEN',
    location: '新竹市',
    personal_statement: '追求極致網頁效能與優雅程式架構的前端狂熱者。',
    about:
      '專注於 React/Next.js 前端開發、效能優化與前端架構設計。熱於分享技術與指導新人，協助將複雜需求轉化為高維護性的程式碼。',
    seniority_level: 'Senior',
    industry: 'Semiconductor',
    want_position: ['Frontend Engineer', 'Web Architect'],
    want_skill: ['React', 'Next.js', 'TypeScript', 'Web Performance'],
    want_topic: ['前端架構設計', '效能優化心法'],
    have_skill: [
      'React',
      'Next.js',
      'TypeScript',
      'TailwindCSS',
      'Webpack',
      'Vitest',
    ],
    have_topic: ['Frontend', 'React', 'TypeScript', 'Performance Optimization'],
    updated_at: 1722241000,
  },
  {
    user_id: 3,
    name: '林建宏 (Alex Lin)',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    job_title: 'Staff Product Manager',
    company: 'TSMC',
    years_of_experience: 'OVER_TEN_YEAR',
    location: '台北市',
    personal_statement:
      '結合商業思維與技術底蘊，帶領團隊打造對市場具影響力的產品。',
    about:
      '超過 12 年跨國科技大廠專案與產品管理實務，專精於敏捷開發導入、團隊流程重塑、大規模系統規劃與產品策略制定。',
    seniority_level: 'Staff',
    industry: 'Semiconductor',
    want_position: ['Product Manager', 'Product Lead'],
    want_skill: ['Product Strategy', 'Agile/Scrum', 'Stakeholder Management'],
    want_topic: ['產品策略佈局', '敏捷團隊實踐', '商業邏輯分析'],
    have_skill: [
      'Agile',
      'Scrum',
      'Product Strategy',
      'Roadmapping',
      'Market Analysis',
    ],
    have_topic: [
      'Agile PM',
      'Scrum',
      'Product Strategy',
      'System Architecture',
      'Career Coaching',
    ],
    updated_at: 1722242000,
  },
  {
    user_id: 4,
    name: '黃雅婷 (Emily Huang)',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
    job_title: 'Data Science Lead',
    company: 'MediaTek',
    years_of_experience: 'FIVE_TO_TEN',
    location: '新竹市',
    personal_statement: '運用數據驅動決策，將龐雜數據轉化為具體的商業價值。',
    about:
      '專精於機器學習、大數據分析與預測模型構建，帶領數據團隊解決多個核心演算法瓶頸，並曾於國際研討會發表多篇論文。',
    seniority_level: 'Lead',
    industry: 'IC Design',
    want_position: ['Data Scientist', 'Machine Learning Engineer'],
    want_skill: ['Python', 'Machine Learning', 'SQL', 'Deep Learning'],
    want_topic: ['數據科學職涯', 'AI 演算法落地應用'],
    have_skill: ['Python', 'PyTorch', 'SQL', 'Big Data', 'Machine Learning'],
    have_topic: [
      'Data Science',
      'Machine Learning',
      'Big Data Analytics',
      'AI Solutions',
    ],
    updated_at: 1722243000,
  },
  {
    user_id: 5,
    name: '蔡明哲 (David Tsai)',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    job_title: 'Backend Tech Lead',
    company: 'Shopee',
    years_of_experience: 'FIVE_TO_TEN',
    location: 'Remote',
    personal_statement: '專注於高併發、高可用性的分散式系統架構與資料庫設計。',
    about:
      '主導蝦皮多個核心電商模組的架構重構與資料庫優化，具備豐富的微服務架構與系統維護經驗，熱衷於解決技術難題。',
    seniority_level: 'Lead',
    industry: 'E-commerce',
    want_position: ['Backend Engineer', 'System Architect'],
    want_skill: ['Go', 'Java', 'Docker', 'Kubernetes', 'MySQL'],
    want_topic: ['高併發系統設計', '微服務架構拆解', '技術經理的管理學'],
    have_skill: ['Go', 'Java', 'Microservices', 'Kubernetes', 'Redis', 'Kafka'],
    have_topic: [
      'Backend Development',
      'System Design',
      'Microservices',
      'Cloud Native',
    ],
    updated_at: 1722244000,
  },
  {
    user_id: 6,
    name: '吳曼妮 (Sophie Wu)',
    avatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    job_title: 'Marketing Director',
    company: 'Line',
    years_of_experience: 'OVER_TEN_YEAR',
    location: '台北市',
    personal_statement: '說好故事，讓品牌深入人心並驅動業務爆發性增長。',
    about:
      '超過 11 年數位行銷與品牌建立經驗，擅長社群行銷策略、網紅異業合作、大型公關活動策劃及成長駭客模式運營。',
    seniority_level: 'Director',
    industry: 'Social Media / Internet',
    want_position: ['Marketing Manager', 'Brand Lead'],
    want_skill: ['Digital Marketing', 'Brand Strategy', 'Growth Hacking'],
    want_topic: ['品牌行銷策略規劃', '社群運營實務與跨界合作'],
    have_skill: ['Brand Strategy', 'Growth Hacking', 'Public Relations', 'SEO'],
    have_topic: [
      'Marketing Strategy',
      'Brand Building',
      'Growth Marketing',
      'PR Strategy',
    ],
    updated_at: 1722245000,
  },
];

const meta: Meta<typeof MentorCardList> = {
  title: 'Components/MentorPool/MentorCardList',
  component: MentorCardList,
  tags: ['autodocs'],
  args: {
    mentors: mockMentors,
    onScrollToBottom: async () => {
      console.log('onScrollToBottom called');
    },
  },
};

export default meta;
type Story = StoryObj<typeof MentorCardList>;

export const Default: Story = {
  args: {
    mentors: mockMentors,
  },
};

export const ShortList: Story = {
  args: {
    mentors: mockMentors.slice(0, 2),
  },
};

export const EmptyList: Story = {
  args: {
    mentors: [],
  },
};
