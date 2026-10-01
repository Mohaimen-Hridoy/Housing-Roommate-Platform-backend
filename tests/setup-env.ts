import path from "node:path";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), "db/test.db")}`;
process.env.JWT_ACCESS_SECRET = "test_access_secret_three_two_one_xx";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_three_two_one_";
process.env.JWT_ISSUER = "housing-backend-test";
process.env.STRIPE_ENABLED = "false";
process.env.GOOGLE_OAUTH_ENABLED = "false";
process.env.BCRYPT_ROUNDS = "4";
process.env.SMTP_HOST = "";
process.env.CORS_ORIGINS = "*";
process.env.API_BASE_URL = "/api/v1";
