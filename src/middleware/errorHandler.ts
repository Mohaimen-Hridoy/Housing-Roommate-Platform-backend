import { Request, Response, NextFunction } from "express";
import { ApiError } from "../common/errors";
import { errorResponse } from "../common/apiResponse";
import { env } from "../config";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  const err = new ApiError(404, `Route ${_req.method} ${_req.originalUrl} not found`);
  next(err);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let error: ApiError;

  if (err instanceof ApiError) {
    error = err;
  } else if (err && typeof err === "object" && "code" in err && typeof err === "object" && err !== null && err instanceof Error) {
    error = new ApiError(500, err.message);
  } else {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred";
    error = new ApiError(500, msg);
  }

  const isOperational = error.isOperational;
  const statusCode = isOperational ? error.statusCode : 500;
  const message = statusCode === 500 ? (env.isProd ? "Something went wrong" : error.message) : error.message;

  if (statusCode === 500) {
    console.error("[errorHandler]", error);
  }

  const response = errorResponse({
    message,
    statusCode,
    code: error.errorCode,
    details: error.details,
  });

  res.status(statusCode).json(response);
}
