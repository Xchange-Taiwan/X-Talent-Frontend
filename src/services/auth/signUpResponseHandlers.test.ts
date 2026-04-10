import { describe, expect, it } from 'vitest';

import {
  createEmailAlreadyRegisteredResponse,
  createRateLimitResponse,
  createSignUpSuccessResponse,
  createValidationErrorResponse,
} from '@/services/auth/signUpResponseHandlers';

describe('createSignUpSuccessResponse', () => {
  it('returns status success, code 0, httpStatus 201', () => {
    expect(createSignUpSuccessResponse()).toEqual({
      status: 'success',
      code: 0,
      httpStatus: 201,
    });
  });
});

describe('createValidationErrorResponse', () => {
  it('returns status error, code 422', () => {
    expect(createValidationErrorResponse()).toMatchObject({
      status: 'error',
      code: 422,
    });
  });
});

describe('createEmailAlreadyRegisteredResponse', () => {
  it('returns status error, code 406', () => {
    expect(createEmailAlreadyRegisteredResponse()).toMatchObject({
      status: 'error',
      code: 406,
    });
  });
});

describe('createRateLimitResponse', () => {
  it('returns status error, code 429', () => {
    expect(createRateLimitResponse()).toMatchObject({
      status: 'error',
      code: 429,
    });
  });
});
