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
