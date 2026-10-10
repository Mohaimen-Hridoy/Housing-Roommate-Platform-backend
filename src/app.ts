import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config";
import { logger } from "./utils/logger";
import { apiRateLimiter, authRateLimiter, createRateLimiter, strictRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiV1Router } from "./routes/v1";
import { docsRedirect, openapiRouter, openapiSpec } from "./features/docs/docs.controller";
import { stripeWebhookRouter } from "./features/payments/stripe.routes";

export function createApp(): Application {
  const app = express();
  app.set("trust proxy", 1);

  app.use((req: Request, _res, next: NextFunction) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.use(helmet());
  app.use(cors({ origin: env.cors.origins, credentials: env.cors.credentials }));

  // Stripe webhook must use a raw body (verified before JSON parsing).
  app.use(`${env.apiBaseUrl}/stripe/webhook`, express.raw({ type: "application/json" }), stripeWebhookRouter);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Locally stored uploads (the Cloudinary driver serves files from its CDN).
  app.use(env.storage.urlPrefix, express.static(env.storage.uploadDir, { maxAge: "7d", fallthrough: true }));

  // Health + docs
  app.get("/", (_req: Request, res: Response) => {
    res.json({ name: "housing-backend", version: "1.0.0", status: "running" });
  });

  // OpenAPI docs (served from the docs controller).
  app.use(`${env.apiBaseUrl}/docs`, openapiRouter);
  app.get("/docs", docsRedirect);
  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(openapiSpec);
  });

  // Payment return redirects directly to frontend
  app.get(["/payment/success", "/payment/cancel"], (req: Request, res: Response) => {
    const outcome = req.path.includes("cancel") ? "cancel" : "success";
    const bookingId = (req.query.bookingId as string) || "";
    const clientBase =
      (process.env.CLIENT_URL && !process.env.CLIENT_URL.includes("backend") ? process.env.CLIENT_URL : null) ||
      (env.webAppUrl && !env.webAppUrl.includes("backend") && !env.webAppUrl.includes("localhost")
        ? env.webAppUrl
        : "https://nestspace-online.vercel.app");
    const query = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";
    res.redirect(302, `${clientBase}/payment/${outcome}${query}`);
  });

  // Versioned API routes with rate limiting.
  app.use(`${env.apiBaseUrl}/auth`, authRateLimiter);
  app.use(`${env.apiBaseUrl}`, apiRateLimiter, apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;

// Expose rate limiter factories for route-level use where needed.
export { createRateLimiter, strictRateLimiter };
