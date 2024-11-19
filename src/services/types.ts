export type AuthResponse = {
  status: string;
  code: number;
  httpStatus?: number;
  message?: string;
};

export const createGeneralErrorResponse = (
  httpStatus: number,
  message: string,
): AuthResponse => ({
  status: 'error',
  code: httpStatus,
  httpStatus,
  message,
});
