import httpStatus from "http-status";

const HttpStatusCode = httpStatus;

export interface ApiResponseMeta {
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: ApiResponseMeta;
  error?: {
    code?: string;
    details?: unknown;
  };
}

export function successResponse<T>(
  data: T,
  options?: { message?: string; statusCode?: number; meta?: ApiResponseMeta }
): ApiResponse<T> {
  return {
    success: true,
    statusCode: options?.statusCode ?? HttpStatusCode.OK,
    message: options?.message ?? "Success",
    data,
    meta: options?.meta,
  };
}

export function createdResponse<T>(data: T, options?: { message?: string; meta?: ApiResponseMeta }): ApiResponse<T> {
  return successResponse(data, { ...options, statusCode: HttpStatusCode.CREATED });
}

export function noContentResponse(): ApiResponse<null> {
  return {
    success: true,
    statusCode: HttpStatusCode.NO_CONTENT,
    message: "No Content",
    data: null,
  };
}

export function errorResponse(error: { message: string; statusCode: number; code?: string; details?: unknown }): ApiResponse<null> {
  return {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    data: null,
    error: { code: error.code, details: error.details },
  };
}
