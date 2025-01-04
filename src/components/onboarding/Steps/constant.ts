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
export enum LocationEnum {
  // A
  AFGHANISTAN = '阿富汗',
  ALBANIA = '阿爾巴尼亞',
  ALGERIA = '阿爾及利亞',
  ANDORRA = '安道爾',
  ANGOLA = '安哥拉',
  ANTIGUA_AND_BARBUDA = '安地卡及巴布達',
  ARGENTINA = '阿根廷',
  ARMENIA = '亞美尼亞',
  AUSTRALIA = '澳洲',
  AUSTRIA = '奧地利',
  AZERBAIJAN = '亞塞拜然',

  // B
  BAHAMAS = '巴哈馬',
  BAHRAIN = '巴林',
  BANGLADESH = '孟加拉',
  BARBADOS = '巴貝多',
  BELARUS = '白俄羅斯',
  BELGIUM = '比利時',
  BELIZE = '貝里斯',
  BENIN = '貝南',
  BHUTAN = '不丹',
  BOLIVIA = '玻利維亞',
  BOSNIA_AND_HERZEGOVINA = '波士尼亞與赫塞哥維納',
  BOTSWANA = '波札那',
  BRAZIL = '巴西',
  BRUNEI = '汶萊',
  BULGARIA = '保加利亞',
  BURKINA_FASO = '布吉納法索',
  BURUNDI = '蒲隆地',

  // C
  CABO_VERDE = '維德角',
  CAMBODIA = '柬埔寨',
  CAMEROON = '喀麥隆',
  CANADA = '加拿大',
  CENTRAL_AFRICAN_REPUBLIC = '中非共和國',
  CHAD = '查德',
  CHILE = '智利',
  CHINA = '中國',
  COLOMBIA = '哥倫比亞',
  COMOROS = '葛摩',
  CONGO_DEMOCRATIC_REPUBLIC = '剛果民主共和國',
  CONGO_REPUBLIC = '剛果共和國',
  COSTA_RICA = '哥斯大黎加',
  COTE_D_IVOIRE = '象牙海岸',
  CROATIA = '克羅埃西亞',
  CUBA = '古巴',
  CYPRUS = '賽普勒斯',
  CZECHIA = '捷克',

  // D
  DENMARK = '丹麥',
  DJIBOUTI = '吉布地',
  DOMINICA = '多米尼克',
  DOMINICAN_REPUBLIC = '多明尼加共和國',

  // E
  ECUADOR = '厄瓜多',
  EGYPT = '埃及',
  EL_SALVADOR = '薩爾瓦多',
  EQUATORIAL_GUINEA = '赤道幾內亞',
  ERITREA = '厄立特里亞',
  ESTONIA = '愛沙尼亞',
  ESWATINI = '史瓦帝尼',
  ETHIOPIA = '衣索比亞',

  // F
  FIJI = '斐濟',
  FINLAND = '芬蘭',
  FRANCE = '法國',

  // G
  GABON = '加彭',
  GAMBIA = '甘比亞',
  GEORGIA = '喬治亞',
  GERMANY = '德國',
  GHANA = '迦納',
  GREECE = '希臘',
  GRENADA = '格瑞那達',
  GUATEMALA = '瓜地馬拉',
  GUINEA = '幾內亞',
  GUINEA_BISSAU = '幾內亞比索',
  GUYANA = '蓋亞那',

  // H
  HAITI = '海地',
  HONDURAS = '宏都拉斯',
  HUNGARY = '匈牙利',

  // I
  ICELAND = '冰島',
  INDIA = '印度',
  INDONESIA = '印尼',
  IRAN = '伊朗',
  IRAQ = '伊拉克',
  IRELAND = '愛爾蘭',
  ISRAEL = '以色列',
  ITALY = '義大利',

  // J
  JAMAICA = '牙買加',
  JAPAN = '日本',
  JORDAN = '約旦',

  // K
  KAZAKHSTAN = '哈薩克',
  KENYA = '肯亞',
  KIRIBATI = '吉里巴斯',
  KOSOVO = '科索沃',
  KUWAIT = '科威特',
  KYRGYZSTAN = '吉爾吉斯',

  // L
  LAOS = '寮國',
  LATVIA = '拉脫維亞',
  LEBANON = '黎巴嫩',
  LESOTHO = '賴索托',
  LIBERIA = '賴比瑞亞',
  LIBYA = '利比亞',
  LIECHTENSTEIN = '列支敦士登',
  LITHUANIA = '立陶宛',
  LUXEMBOURG = '盧森堡',

  // M
  MADAGASCAR = '馬達加斯加',
  MALAWI = '馬拉威',
  MALAYSIA = '馬來西亞',
  MALDIVES = '馬爾地夫',
  MALI = '馬利',
  MALTA = '馬耳他',
  MARSHALL_ISLANDS = '馬紹爾群島',
  MAURITANIA = '茅利塔尼亞',
  MAURITIUS = '模里西斯',
  MEXICO = '墨西哥',
  MICRONESIA = '密克羅尼西亞',
  MOLDOVA = '摩爾多瓦',
  MONACO = '摩納哥',
  MONGOLIA = '蒙古',
  MONTENEGRO = '蒙特內哥羅',
  MOROCCO = '摩洛哥',
  MOZAMBIQUE = '莫三比克',
  MYANMAR = '緬甸',

  // N
  NAMIBIA = '納米比亞',
  NAURU = '諾魯',
  NEPAL = '尼泊爾',
  NETHERLANDS = '荷蘭',
  NEW_ZEALAND = '紐西蘭',
  NICARAGUA = '尼加拉瓜',
  NIGER = '尼日',
  NIGERIA = '奈及利亞',
  NORTH_KOREA = '北韓',
  NORTH_MACEDONIA = '北馬其頓',
  NORWAY = '挪威',

  // O
  OMAN = '阿曼',

  // P
  PAKISTAN = '巴基斯坦',
  PALAU = '帛琉',
  PALESTINE = '巴勒斯坦',
  PANAMA = '巴拿馬',
  PAPUA_NEW_GUINEA = '巴布亞紐幾內亞',
  PARAGUAY = '巴拉圭',
  PERU = '秘魯',
  PHILIPPINES = '菲律賓',
  POLAND = '波蘭',
  PORTUGAL = '葡萄牙',

  // Q
  QATAR = '卡達',

  // R
  ROMANIA = '羅馬尼亞',
  RUSSIA = '俄羅斯',
  RWANDA = '盧安達',

  // S
  SAINT_KITTS_AND_NEVIS = '聖克里斯多福及尼維斯',
  SAINT_LUCIA = '聖露西亞',
  SAINT_VINCENT_AND_THE_GRENADINES = '聖文森及格瑞那丁',
  SAMOA = '薩摩亞',
  SAN_MARINO = '聖馬利諾',
  SAO_TOME_AND_PRINCIPE = '聖多美及普林西比',
  SAUDI_ARABIA = '沙烏地阿拉伯',
  SENEGAL = '塞內加爾',
  SERBIA = '塞爾維亞',
  SEYCHELLES = '塞席爾',
  SIERRA_LEONE = '獅子山',
  SINGAPORE = '新加坡',
  SLOVAKIA = '斯洛伐克',
  SLOVENIA = '斯洛維尼亞',
  SOLOMON_ISLANDS = '索羅門群島',
  SOMALIA = '索馬利亞',
  SOUTH_AFRICA = '南非',
  SOUTH_KOREA = '南韓',
  SOUTH_SUDAN = '南蘇丹',
  SPAIN = '西班牙',
  SRI_LANKA = '斯里蘭卡',
  SUDAN = '蘇丹',
  SURINAME = '蘇利南',
  SWEDEN = '瑞典',
  SWITZERLAND = '瑞士',
  SYRIA = '敘利亞',

  // T
  TWN = '台灣',
  TAJIKISTAN = '塔吉克',
  TANZANIA = '坦尚尼亞',
  THAILAND = '泰國',
  TIMOR_LESTE = '東帝汶',
  TOGO = '多哥',
  TONGA = '東加',
  TRINIDAD_AND_TOBAGO = '千里達及托巴哥',
  TUNISIA = '突尼西亞',
  TURKEY = '土耳其',
  TURKMENISTAN = '土庫曼',
  TUVALU = '吐瓦魯',

  // U
  UGANDA = '烏干達',
  UKRAINE = '烏克蘭',
  UAE = '阿拉伯聯合大公國',
  UK = '英國',
  USA = '美國',
  URUGUAY = '烏拉圭',
  UZBEKISTAN = '烏茲別克',

  // V
  VANUATU = '瓦努阿圖',
  VATICAN_CITY = '梵蒂岡',
  VENEZUELA = '委內瑞拉',
  VIETNAM = '越南',

  // Y
  YEMEN = '葉門',

  // Z
  ZAMBIA = '尚比亞',
  ZIMBABWE = '辛巴威',
}

export const locationOptions = enumToOptionsArray(LocationEnum);

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
