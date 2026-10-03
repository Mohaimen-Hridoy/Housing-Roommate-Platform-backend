import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config";
import { logger } from "./logger";

const logConfig: Prisma.LogLevel[] = env.isDev ? ["query", "error", "warn"] : ["error", "warn"];

/**
 * The test suite generates its own SQLite client into a separate directory
 * (see prisma/schema.test.prisma) and points DATABASE_URL at db/test.db, so it
 * must not touch the PostgreSQL client that dev, build and seed rely on.
 */
function createClient(): PrismaClient {
  if (!env.isTest) {
    // Required lazily so the PostgreSQL client is only loaded outside tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: ProdClient } = require("@prisma/client") as typeof import("@prisma/client");
    return new ProdClient({ log: logConfig });
  }

  const testClientPath = path.resolve(process.cwd(), "node_modules", ".prisma", "test-client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: TestClient } = require(testClientPath) as typeof import("@prisma/client");
  return new TestClient({ log: logConfig });
}

/** `PrismaClient` is type-only here, so the event map is restated explicitly. */
type ObservablePrismaClient = PrismaClient & {
  $on(event: "error", callback: (event: Prisma.LogEvent) => void): void;
};

export const prisma: ObservablePrismaClient = createClient();

prisma.$on("error", (e) => {
  logger.error("Prisma error", e);
});

export type PrismaTransactionClient = typeof prisma;