export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UserError extends AppError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, 400, details); // 400 for user-related errors
  }
}

// Define specific user-related errors
export class UserAlreadyExistsError extends UserError {
  constructor(email: string) {
    super('User with this email already exists', 'USER_ALREADY_EXISTS', {
      email,
    });
  }
}

export class InvalidUserDataError extends UserError {
  constructor(details: unknown) {
    super('Invalid user data provided', 'INVALID_USER_DATA', details);
  }
}
