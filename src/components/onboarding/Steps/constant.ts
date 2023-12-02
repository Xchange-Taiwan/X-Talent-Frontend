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
  SOFTWARE_AND_NETWORK = '軟體及網路相關',
  TELECOMUNICATION = '電信及通訊相關',
  COMPUTER_AND_CONSUMER_ELECTRONICS = '電腦及消費性電子製造業',
  SEMICONDUCTOR = '半導體業',
  FINANCE = '金融業',
  CONSULTING = '顧問業',
  STUDENT = '學生',
  OTHER = '其他',
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
