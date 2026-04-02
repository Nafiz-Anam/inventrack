class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: any;

  constructor(
    statusCode: number,
    message: string | undefined,
    isOperational = true,
    stack = '',
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
