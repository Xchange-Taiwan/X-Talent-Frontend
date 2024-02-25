/**
 * 轉換 Enum 為下拉選單的選項
 * @param enumObj
 * @returns
 */
function enumToOptionsArray(
  enumObj: Record<string, string>,
): { value: string; text: string }[] {
  return Object.keys(enumObj).map((key) => ({
    value: key,
    text: enumObj[key],
  }));
}

/**
 * 地區
 */
export enum RegionEnum {
  TAIPEI = '台北市',
  NEW_TAIPEI = '新北市',
  YILAN = '宜蘭縣',
  KEELUNG = '基隆市',
  TAOYUAN = '桃園市',
  HSINCHU = '新竹縣市',
  MIAOLI = '苗栗縣',
  TAICHUNG = '台中市',
  CHANGHUA = '彰化縣',
  NANTOU = '南投縣',
  YUNLIN = '雲林縣',
  CHIAYI = '嘉義縣市',
  TAINAN = '台南市',
  KAOHSIUNG = '高雄市',
  PINGTUNG = '屏東縣',
  TAITUNG = '台東縣',
  HUALIEN = '花蓮縣',
  PENGHU = '澎湖縣',
  KINMEN = '金門縣',
  LIENCHIANG = '連江縣',
  OTHER_ASIA = '亞洲其他地區',
  OCEANIA = '大洋洲',
  USA_CANADA = '美加地區',
  CENTRAL_SOUTH_AMERICA = '中南美洲',
  EUROPE = '歐洲',
  AFRICA = '非洲',
}

export const regionOptions = enumToOptionsArray(RegionEnum);

/**
 * 總年資
 */
export enum TotalWorkSpanEnum {
  BELOW_ONE_YEAR = '1 年以下',
  ONE_TO_THREE = '1~3 年',
  THREE_TO_FIVE = '3~5 年',
  FIVE_TO_TEN = '5~10 年',
  OVER_TEN_YEAR = '10 年以上',
}

export const totalWorkSpanOptions = enumToOptionsArray(TotalWorkSpanEnum);

/**
 * 產業類別
 */
export enum IndustryEnum {
  SOFTWARE_AND_NETWORK = '軟體及網路相關',
  TELECOMUNICATION = '電信及通訊相關',
  COMPUTER_AND_CONSUMER_ELECTRONICS = '電腦及消費性電子製造業',
  SEMICONDUCTOR = '半導體業',
  FINANCE = '金融業',
  CONSULTING = '顧問業',
  STUDENT = '學生',
  OTHER = '其他',
}

export const industryOptions = enumToOptionsArray(IndustryEnum);

/**
 * 有興趣的職位或領域
 */
export enum InterestedRoleEnum {
  PRODUCT_MANAGER = '產品經理',
  UI_UX_DESIGNER = 'UX/UI 設計師',
  PRODUCT_MARKETING = '產品行銷',
  BUSINESS_ANALYST = '商業分析',
  BUSINESS_DEVELOPMENT = '商業開發',
  DATA_SCIENCE = '資料科學',
  FRONTEND_ENGINEER = '前端工程師',
  BACKEND_ENGINEER = '後端工程師',
  TEST_ENGINEER = '測試工程師',
  INFORMATION_ARCHITECTURE_ENGINEER = '資訊架構工程師',
  OTHER = '其他',
}

export const interestedRoleOptions = enumToOptionsArray(InterestedRoleEnum);

/**
 * 想精進的能力
 */
export enum SkillEnhancementTargetEnum {
  PRODUCT_PLANNING = '產品企劃',
  PROJECT_MANAGEMENT = '專案管理',
  STRATEGY_PLANNING = '策略規劃',
  USER_EXPERIENCE_DESIGN = '用戶體驗設計',
  INTERDEPARTMENTAL_COMMUNICATION = '跨部門溝通',
  BUSINESS_ANALYSIS = '商業分析',
  FRONTEND_DEVELOPMENT = '陌生開發',
  PRESENTATION_CREATION = '簡報製作',
  PYTHON = 'Python',
  JAVASCRIPT = 'Javascript',
  SQL = 'SQL',
  OTHER = '其他',
}

export const skillEnhancementTargetOptions = enumToOptionsArray(
  SkillEnhancementTargetEnum,
);

/**
 * 想聊聊的主題？
 */
export enum talkTopicEnum {
  INDUSTRY_KNOWLEDGE = '產業知識',
  COMPANY_CULTURE_OPPORTUNITIES = '公司文化/機會',
  RESUME_CHECKUP = '履歷健檢',
  JOB_SEEKING_EXPERIENCE_SHARING = '求職經驗分享',
  MOCK_INTERVIEW = '模擬面試',
  JOB_POSITION_EXPERTISE = '職位專業知識',
}

export const talkTopicOptions = enumToOptionsArray(talkTopicEnum);
