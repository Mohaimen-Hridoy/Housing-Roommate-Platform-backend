import httpStatus from "http-status";

const HttpStatusCode = httpStatus;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, options?: { isOperational?: boolean; errorCode?: string; details?: unknown }) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.errorCode = options?.errorCode;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad Request", details?: unknown) {
    super(HttpStatusCode.BAD_REQUEST, message, { errorCode: "BAD_REQUEST", details });
  }
}
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(HttpStatusCode.UNAUTHORIZED, message, { errorCode: "UNAUTHORIZED", details });
  }
}
export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", details?: unknown) {
    super(HttpStatusCode.FORBIDDEN, message, { errorCode: "FORBIDDEN", details });
  }
}
export class NotFoundError extends ApiError {
  constructor(message = "Not Found", details?: unknown) {
    super(HttpStatusCode.NOT_FOUND, message, { errorCode: "NOT_FOUND", details });
  }
}
export class ConflictError extends ApiError {
  constructor(message = "Conflict", details?: unknown) {
    super(HttpStatusCode.CONFLICT, message, { errorCode: "CONFLICT", details });
  }
}
export class TooManyRequestsError extends ApiError {
  constructor(message = "Too Many Requests", details?: unknown) {
    super(HttpStatusCode.TOO_MANY_REQUESTS, message, { errorCode: "TOO_MANY_REQUESTS", details });
  }
}
export class ValidationError extends ApiError {
  constructor(message = "Validation Failed", details?: unknown) {
    super(HttpStatusCode.UNPROCESSABLE_ENTITY, message, { errorCode: "VALIDATION_ERROR", details });
  }
}
