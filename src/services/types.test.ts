import { describe, expect, it } from 'vitest';

import { createGeneralErrorResponse } from '@/services/types';

describe('createGeneralErrorResponse', () => {
  it('returns status error with given httpStatus as code and message', () => {
    expect(createGeneralErrorResponse(404, 'Not found')).toEqual({
      status: 'error',
      code: 404,
      httpStatus: 404,
      message: 'Not found',
    });
  });
});
