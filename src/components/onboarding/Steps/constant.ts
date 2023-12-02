/**
 * 地區
 */
export enum RegionEnum {
  TAIPEI = 'Taipei',
  NEW_TAIPEI = 'NewTaipei',
  YILAN = 'Yilan',
  KEELUNG = 'Keelung',
  TAOYUAN = 'Taoyuan',
  HSINCHU = 'Hsinchu',
  MIAOLI = 'Miaoli',
  TAICHUNG = 'Taichung',
  CHANGHUA = 'Changhua',
  NANTOU = 'Nantou',
  YUNLIN = 'Yunlin',
  CHIAYI = 'Chiayi',
  TAINAN = 'Tainan',
  KAOHSIUNG = 'Kaohsiung',
  PINGTUNG = 'Pingtung',
  TAITUNG = 'Taitung',
  HUALIEN = 'Hualien',
  PENGHU = 'Penghu',
  KINMEN = 'Kinmen',
  LIENCHIANG = 'Lienchiang',
  OTHER_ASIA = 'OtherAsia',
  OCEANIA = 'Oceania',
  USA_CANADA = 'USACanada',
  CENTRAL_SOUTH_AMERICA = 'CentralSouthAmerica',
  EUROPE = 'Europe',
  AFRICA = 'Africa',
}

export const regionOptions = [
  { value: RegionEnum.TAIPEI, text: '台北市' },
  { value: RegionEnum.NEW_TAIPEI, text: '新北市' },
  { value: RegionEnum.YILAN, text: '宜蘭縣' },
  { value: RegionEnum.KEELUNG, text: '基隆市' },
  { value: RegionEnum.TAOYUAN, text: '桃園市' },
  { value: RegionEnum.HSINCHU, text: '新竹縣市' },
  { value: RegionEnum.MIAOLI, text: '苗栗縣' },
  { value: RegionEnum.TAICHUNG, text: '台中市' },
  { value: RegionEnum.CHANGHUA, text: '彰化縣' },
  { value: RegionEnum.NANTOU, text: '南投縣' },
  { value: RegionEnum.YUNLIN, text: '雲林縣' },
  { value: RegionEnum.CHIAYI, text: '嘉義縣市' },
  { value: RegionEnum.TAINAN, text: '台南市' },
  { value: RegionEnum.KAOHSIUNG, text: '高雄市' },
  { value: RegionEnum.PINGTUNG, text: '屏東縣' },
  { value: RegionEnum.TAITUNG, text: '台東縣' },
  { value: RegionEnum.HUALIEN, text: '花蓮縣' },
  { value: RegionEnum.PENGHU, text: '澎湖縣' },
  { value: RegionEnum.KINMEN, text: '金門縣' },
  { value: RegionEnum.LIENCHIANG, text: '連江縣' },
  { value: RegionEnum.OTHER_ASIA, text: '亞洲其他地區' },
  { value: RegionEnum.OCEANIA, text: '大洋洲' },
  { value: RegionEnum.USA_CANADA, text: '美加地區' },
  { value: RegionEnum.CENTRAL_SOUTH_AMERICA, text: '中南美洲' },
  { value: RegionEnum.EUROPE, text: '歐洲' },
  { value: RegionEnum.AFRICA, text: '非洲' },
] as const;

/**
 * 總年資
 */
export enum TotalWorkSpanEnum {
  BELOW_ONE_YEAR = 'BELOW_ONE_YEAR',
  ONE_TO_THREE = 'ONE_TO_THREE',
  THREE_TO_FIVE = 'THREE_TO_FIVE',
  FIVE_TO_TEN = 'FIVE_TO_TEN',
  OVER_TEN_YEAR = 'OVER_TEN_YEAR',
}

export const totalWorkSpanOptions = [
  {
    value: TotalWorkSpanEnum.BELOW_ONE_YEAR,
    text: '1 年以下',
  },
  {
    value: TotalWorkSpanEnum.ONE_TO_THREE,
    text: '1~3 年',
  },
  {
    value: TotalWorkSpanEnum.THREE_TO_FIVE,
    text: '3~5 年',
  },
  {
    value: TotalWorkSpanEnum.FIVE_TO_TEN,
    text: '5~10 年',
  },
  {
    value: TotalWorkSpanEnum.OVER_TEN_YEAR,
    text: '10 年以上',
  },
] as const;

export enum IndustryEnum {}

/**
 * 產業類別
 */
export enum IndustryEnum {
  SOFTWARE_AND_NETWORK = 'SOFTWARE_AND_NETWORK',
  TELECOMUNICATION = 'TELECOMUNICATION',
  COMPUTER_AND_CONSUMER_ELECTRONICS = 'COMPUTER_AND_CONSUMER_ELECTRONICS',
  SEMICONDUCTOR = 'SEMICONDUCTOR',
  FINANCE = 'FINANCE',
  CONSULTING = 'CONSULTING',
  STUDENT = 'STUDENT',
  OTHER = 'OTHER',
}

export const industryOptions = [
  { value: IndustryEnum.SOFTWARE_AND_NETWORK, text: '軟體及網路相關' },
  { value: IndustryEnum.TELECOMUNICATION, text: '電信及通訊相關' },
  {
    value: IndustryEnum.COMPUTER_AND_CONSUMER_ELECTRONICS,
    text: '電腦及消費性電子製造業',
  },
  { value: IndustryEnum.SEMICONDUCTOR, text: '半導體業' },
  { value: IndustryEnum.FINANCE, text: '金融業' },
  { value: IndustryEnum.CONSULTING, text: '顧問業' },
  { value: IndustryEnum.STUDENT, text: '學生' },
  { value: IndustryEnum.OTHER, text: '其他' },
] as const;

/**
 * 有興趣的職位或領域
 */
export enum InterestedRoleEnum {
  PRODUCT_MANAGER = 'PRODUCT_MANAGER',
  UI_UX_DESIGNER = 'UI_UX_DESIGNER/UX設計',
  PRODUCT_MARKETING = 'PRODUCT_MARKETING',
  BUSINESS_ANALYST = 'BUSINESS_ANALYST',
  BUSINESS_DEVELOPMENT = 'BUSINESS_DEVELOPMENT',
  DATA_SCIENCE = 'DATA_SCIENCE',
  FRONTEND_ENGINEER = 'FRONTEND_ENGINEER',
  BACKEND_ENGINEER = 'BACKEND_ENGINEER',
  TEST_ENGINEER = 'TEST_ENGINEER',
  INFORMATION_ARCHITECTURE_ENGINEER = 'INFORMATION_ARCHITECTURE_ENGINEER',
  OTHER = 'OTHER',
}

export const interestedRoleOptions = [
  { value: InterestedRoleEnum.PRODUCT_MANAGER, text: '產品經理' },
  { value: InterestedRoleEnum.UI_UX_DESIGNER, text: '💎 UX/UI 設計師' },
  { value: InterestedRoleEnum.PRODUCT_MARKETING, text: '產品行銷' },
  { value: InterestedRoleEnum.BUSINESS_ANALYST, text: '商業分析' },
  { value: InterestedRoleEnum.BUSINESS_DEVELOPMENT, text: '商業開發' },
  { value: InterestedRoleEnum.DATA_SCIENCE, text: '資料科學' },
  { value: InterestedRoleEnum.FRONTEND_ENGINEER, text: '💻 前端工程師' },
  { value: InterestedRoleEnum.BACKEND_ENGINEER, text: '後端工程師' },
  { value: InterestedRoleEnum.TEST_ENGINEER, text: '測試工程師' },
  {
    value: InterestedRoleEnum.INFORMATION_ARCHITECTURE_ENGINEER,
    text: '資訊架構工程師',
  },
  { value: InterestedRoleEnum.OTHER, text: '其他' },
] as const;

/**
 * 想精進的能力
 */
export enum SkillEnhancementTargetEnum {
  PRODUCT_PLANNING = 'PRODUCT_PLANNING',
  PROJECT_MANAGEMENT = 'PROJECT_MANAGEMENT',
  STRATEGY_PLANNING = 'STRATEGY_PLANNING',
  USER_EXPERIENCE_DESIGN = 'USER_EXPERIENCE_DESIGN',
  INTERDEPARTMENTAL_COMMUNICATION = 'INTERDEPARTMENTAL_COMMUNICATION',
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',
  FRONTEND_DEVELOPMENT = 'FRONTEND_DEVELOPMENT',
  PRESENTATION_CREATION = 'PRESENTATION_CREATION',
  PYTHON = 'PYTHON',
  JAVASCRIPT = 'JAVASCRIPT',
  SQL = 'SQL',
  OTHER = 'OTHER',
}

export const skillEnhancementTargetOptions = [
  { value: SkillEnhancementTargetEnum.PRODUCT_PLANNING, text: '產品企劃' },
  { value: SkillEnhancementTargetEnum.PROJECT_MANAGEMENT, text: '專案管理' },
  { value: SkillEnhancementTargetEnum.STRATEGY_PLANNING, text: '策略規劃' },
  {
    value: SkillEnhancementTargetEnum.USER_EXPERIENCE_DESIGN,
    text: '用戶體驗設計',
  },
  {
    value: SkillEnhancementTargetEnum.INTERDEPARTMENTAL_COMMUNICATION,
    text: '跨部門溝通',
  },
  { value: SkillEnhancementTargetEnum.BUSINESS_ANALYSIS, text: '商業分析' },
  { value: SkillEnhancementTargetEnum.FRONTEND_DEVELOPMENT, text: '陌生開發' },
  { value: SkillEnhancementTargetEnum.PRESENTATION_CREATION, text: '簡報製作' },
  { value: SkillEnhancementTargetEnum.PYTHON, text: 'Python' },
  { value: SkillEnhancementTargetEnum.JAVASCRIPT, text: 'Javascript' },
  { value: SkillEnhancementTargetEnum.SQL, text: 'SQL' },
  { value: SkillEnhancementTargetEnum.OTHER, text: '其他' },
] as const;

/**
 * 想聊聊的主題？
 */
export enum talkTopicEnum {
  INDUSTRY_KNOWLEDGE = 'INDUSTRY_KNOWLEDGE',
  COMPANY_CULTURE_OPPORTUNITIES = 'COMPANY_CULTURE_OPPORTUNITIES',
  RESUME_CHECKUP = 'RESUME_CHECKUP',
  JOB_SEEKING_EXPERIENCE_SHARING = 'JOB_SEEKING_EXPERIENCE_SHARING',
  MOCK_INTERVIEW = 'MOCK_INTERVIEW',
  JOB_POSITION_EXPERTISE = 'JOB_POSITION_EXPERTISE',
}

export const talkTopicOptions = [
  { value: talkTopicEnum.INDUSTRY_KNOWLEDGE, text: '產業知識' },
  {
    value: talkTopicEnum.COMPANY_CULTURE_OPPORTUNITIES,
    text: '公司文化/機會',
  },
  { value: talkTopicEnum.RESUME_CHECKUP, text: '履歷健檢' },
  {
    value: talkTopicEnum.JOB_SEEKING_EXPERIENCE_SHARING,
    text: '求職經驗分享',
  },
  { value: talkTopicEnum.MOCK_INTERVIEW, text: '模擬面試' },
  {
    value: talkTopicEnum.JOB_POSITION_EXPERTISE,
    text: '職位專業知識',
  },
] as const;
