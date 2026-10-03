const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

/**
 * Prepares the SQLite test database.
 *
 * `prisma/schema.test.prisma` declares its own generator `output`, so this
 * generate call writes the SQLite client to node_modules/.prisma/test-client
 * and leaves the PostgreSQL client in node_modules/.prisma/client untouched.
 *
 * The child process is given the SQLite DATABASE_URL explicitly: prisma.config.ts
 * reads DATABASE_URL from the ambient environment, which otherwise points at
 * the PostgreSQL database from .env.
 */
module.exports = async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  const dbDir = path.resolve(root, "db");
  fs.mkdirSync(dbDir, { recursive: true });

  const testDbUrl = `file:${path.resolve(dbDir, "test.db")}`;
  const childEnv = { ...process.env, NODE_ENV: "test", DATABASE_URL: testDbUrl };

  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  const runPrisma = (args) =>
    execFileSync(process.execPath, [prismaCli, ...args], { cwd: root, env: childEnv, stdio: "inherit" });

  runPrisma(["generate", "--schema", "prisma/schema.test.prisma"]);
  runPrisma(["db", "push", "--schema", "prisma/schema.test.prisma", "--skip-generate", "--accept-data-loss"]);
};