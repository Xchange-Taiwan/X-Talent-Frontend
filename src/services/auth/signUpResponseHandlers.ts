import { AuthResponse } from '../types';

export const createSignUpSuccessResponse = (): AuthResponse => ({
  status: 'success',
  code: 0,
  httpStatus: 201,
});

export const createValidationErrorResponse = (): AuthResponse => ({
  status: 'error',
  code: 422,
  httpStatus: 422,
  message: '驗證錯誤。請確保所有欄位均正確填寫。',
});

export const createEmailAlreadyRegisteredResponse = (): AuthResponse => ({
  status: 'error',
  code: 406,
  httpStatus: 406,
  message: '此電子郵件已被註冊。請使用其他電子郵件或登錄。',
});

export const createRateLimitResponse = (): AuthResponse => ({
  status: 'error',
  code: 429,
  httpStatus: 429,
  message: '您已超出最大註冊嘗試次數。請稍後再試。',
});
