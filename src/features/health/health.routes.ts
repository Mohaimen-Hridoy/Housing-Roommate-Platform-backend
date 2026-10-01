import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma";
import { successResponse } from "../../common/apiResponse";
import { env } from "../../config";
import { isStripeEnabled } from "../../utils/stripe";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(
      successResponse(
        {
          status: "ok",
          uptime: process.uptime(),
          db: "connected",
          googleOAuth: env.google.enabled,
          stripe: isStripeEnabled(),
          timestamp: new Date().toISOString(),
        },
        { message: "Service is healthy" }
      )
    );
  } catch (err) {
    next(err);
  }
});

healthRouter.get("/live", (_req: Request, res: Response) => {
  res.json(successResponse({ status: "alive", timestamp: new Date().toISOString() }, { message: "Alive" }));
});

healthRouter.get("/ready", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(successResponse({ status: "ready", db: "connected" }, { message: "Ready" }));
  } catch (err) {
    next(err);
  }
});
