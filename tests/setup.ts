import path from "node:path";
import { mkdirSync } from "node:fs";
import { prisma } from "../src/utils/prisma";

const TEST_DB = `file:${path.resolve(process.cwd(), "db/test.db")}`;

mkdirSync(path.resolve(process.cwd(), "db"), { recursive: true });

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DB;
process.env.JWT_ACCESS_SECRET = "test_access_secret_three_two_one_xx";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_three_two_one_";
process.env.JWT_ISSUER = "housing-backend-test";
process.env.STRIPE_ENABLED = "false";
process.env.GOOGLE_OAUTH_ENABLED = "false";
process.env.BCRYPT_ROUNDS = "4";
process.env.SMTP_HOST = "";

process.env.CORS_ORIGINS = "*";
process.env.API_BASE_URL = "/api/v1";
process.env.UPLOAD_DIR = path.resolve(process.cwd(), "db/test-uploads");

async function resetDatabase() {
  const delegates = prisma as unknown as Record<string, { deleteMany(args?: unknown): Promise<unknown> }>;
  const models = [
    "auditLog",
    "review",
    "favorite",
    "payment",
    "roomImage",
    "propertyImage",
    "booking",
    "room",
    "propertyAmenity",
    "property",
    "amenity",
    "message",
    "user",
  ];
  for (const model of models) {
    await delegates[model]?.deleteMany({});
  }
}

beforeEach(async () => {
  await resetDatabase();
});
