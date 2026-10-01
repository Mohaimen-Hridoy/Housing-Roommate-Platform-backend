import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { env } from "../config";

export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyPrefix?: string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? env.rateLimit.windowMs,
    max: options.max ?? env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message ?? "Too many requests, please try again later.",
    skip: (_req) => env.isTest,
  });
}

export const apiRateLimiter = createRateLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
});

export const authRateLimiter = createRateLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  message: "Too many authentication attempts, please try again later.",
});

export const strictRateLimiter = (max: number): RateLimitRequestHandler =>
  createRateLimiter({ windowMs: env.rateLimit.windowMs, max });
