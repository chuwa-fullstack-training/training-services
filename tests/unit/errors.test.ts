import { describe, it, expect } from 'bun:test';
import { AppError, UserError, UserAlreadyExistsError, InvalidUserDataError } from '../../src/lib/errors';

describe('AppError', () => {
  it('has correct message, code, status, and details', () => {
    const err = new AppError('something went wrong', 'TEST_CODE', 500, { hint: 'check logs' });
    expect(err.message).toBe('something went wrong');
    expect(err.code).toBe('TEST_CODE');
    expect(err.status).toBe(500);
    expect(err.details).toEqual({ hint: 'check logs' });
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('works without optional details', () => {
    const err = new AppError('bare error', 'BARE', 503);
    expect(err.details).toBeUndefined();
  });
});

describe('UserError', () => {
  it('is an AppError with status 400', () => {
    const err = new UserError('bad input', 'BAD_INPUT');
    expect(err.status).toBe(400);
    expect(err instanceof AppError).toBe(true);
    expect(err.name).toBe('UserError');
  });
});

describe('UserAlreadyExistsError', () => {
  it('has correct code and includes the email in details', () => {
    const err = new UserAlreadyExistsError('dup@example.com');
    expect(err.code).toBe('USER_ALREADY_EXISTS');
    expect(err.status).toBe(400);
    expect((err.details as { email: string }).email).toBe('dup@example.com');
    expect(err.message).toMatch(/already exists/i);
  });
});

describe('InvalidUserDataError', () => {
  it('has correct code and preserves details', () => {
    const err = new InvalidUserDataError({ email: 'Invalid email' });
    expect(err.code).toBe('INVALID_USER_DATA');
    expect(err.status).toBe(400);
    expect((err.details as { email: string }).email).toBe('Invalid email');
  });
});
