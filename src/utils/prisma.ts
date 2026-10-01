import { PrismaClient } from "@prisma/client";
import { env } from "../config";
import { logger } from "./logger";

export const prisma = new PrismaClient({
  log: env.isDev ? ["query", "error", "warn"] : ["error", "warn"],
});

prisma.$on("error", (e) => {
  logger.error("Prisma error", e);
});

export type PrismaTransactionClient = typeof prisma;
