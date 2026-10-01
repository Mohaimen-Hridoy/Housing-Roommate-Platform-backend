import { env } from "./config";
import { app } from "./app";
import { prisma } from "./utils/prisma";
import { logger } from "./utils/logger";
import { seed } from "./seed";

async function main() {
  if (env.isTest) return;

  await prisma.$connect();
  logger.info("Database connected");

  if (env.isDev) {
    try {
      await seed();
    } catch (err) {
      logger.warn("Seed skipped or failed", err instanceof Error ? err.message : String(err));
    }
  }

  const server = app.listen(env.port, env.host, () => {
    logger.info(`housing-backend listening on http://${env.host}:${env.port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down...");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.fatal("Failed to start server", err);
  process.exit(1);
});
