const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

module.exports = async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  const dbDir = path.resolve(root, "db");
  fs.mkdirSync(dbDir, { recursive: true });
  const TEST_DB = `file:${path.resolve(dbDir, "test.db")}`;

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = TEST_DB;

  execSync("npx prisma generate --schema prisma/schema.test.prisma", { stdio: "inherit" });
  execSync("npx prisma db push --schema prisma/schema.test.prisma --skip-generate --accept-data-loss", { stdio: "inherit" });
};
