import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const parseBool = (v: string | undefined, fallback: boolean): boolean => {
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().default("http://localhost:4000"),
    WEB_APP_URL: z.string().default("http://localhost:5173"),
    API_BASE_URL: z.string().default("/api/v1"),
    CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),
    CORS_CREDENTIALS: z.preprocess((v) => parseBool(v as string, true), z.boolean()),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
    JWT_ISSUER: z.string().default("housing-backend"),
    BCRYPT_ROUNDS: z.coerce.number().default(12),
    GOOGLE_OAUTH_ENABLED: z.preprocess((v) => parseBool(v as string, false), z.boolean()),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().default("/api/v1/auth/google/callback"),
    STRIPE_ENABLED: z.preprocess((v) => parseBool(v as string, false), z.boolean()),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_CURRENCY: z.string().default("usd"),
    STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().default(5),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().default(120),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
    EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.preprocess((v) => parseBool(v as string, false), z.boolean()),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default("noreply@housing.local"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    STORAGE_DRIVER: z.enum(["auto", "cloudinary", "local"]).default("auto"),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default("housing"),
    UPLOAD_DIR: z.string().default("uploads"),
    UPLOAD_URL_PREFIX: z.string().default("/uploads"),
    UPLOAD_MAX_FILES: z.coerce.number().default(6),
    UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().default(5),
    UPLOAD_ALLOWED_MIME: z
      .string()
      .default("image/jpeg,image/png,image/webp,image/avif"),
    REDIS_URL: z.string().optional(),
    CACHE_ENABLED: z.preprocess((v) => parseBool(v as string, true), z.boolean()),
    CACHE_TTL_SECONDS: z.coerce.number().default(60),
  })
  .passthrough();

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
  throw new Error(`[config] Invalid environment configuration:\n${errors}`);
}

const c = result.data;

export const env = {
  isProd: c.NODE_ENV === "production",
  isTest: c.NODE_ENV === "test",
  isDev: c.NODE_ENV === "development",
  nodeEnv: c.NODE_ENV,
  port: c.PORT,
  host: c.HOST,
  databaseUrl: c.DATABASE_URL,
  appUrl: c.APP_URL,
  webAppUrl: c.WEB_APP_URL,
  apiBaseUrl: c.API_BASE_URL,
  cors: {
    origins: c.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: c.CORS_CREDENTIALS,
  },
  jwt: {
    accessSecret: c.JWT_ACCESS_SECRET,
    accessExpiresIn: c.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: c.JWT_REFRESH_SECRET,
    refreshExpiresIn: c.JWT_REFRESH_EXPIRES_IN,
    issuer: c.JWT_ISSUER,
  },
  bcryptRounds: c.BCRYPT_ROUNDS,
  google: {
    enabled: c.GOOGLE_OAUTH_ENABLED,
    clientId: c.GOOGLE_CLIENT_ID ?? "",
    clientSecret: c.GOOGLE_CLIENT_SECRET ?? "",
    callbackUrl: c.GOOGLE_CALLBACK_URL,
  },
  stripe: {
    enabled: c.STRIPE_ENABLED,
    secretKey: c.STRIPE_SECRET_KEY ?? "",
    webhookSecret: c.STRIPE_WEBHOOK_SECRET ?? "",
    currency: c.STRIPE_CURRENCY,
    platformFeePercent: c.STRIPE_PLATFORM_FEE_PERCENT,
  },
  rateLimit: {
    windowMs: c.RATE_LIMIT_WINDOW_MS,
    max: c.RATE_LIMIT_MAX,
    authMax: c.RATE_LIMIT_AUTH_MAX,
  },
  email: {
    provider: c.EMAIL_PROVIDER,
    host: c.SMTP_HOST,
    port: c.SMTP_PORT,
    secure: c.SMTP_SECURE,
    user: c.SMTP_USER,
    pass: c.SMTP_PASS,
    from: c.EMAIL_FROM,
  },
  storage: {
    driver:
      c.STORAGE_DRIVER === "auto"
        ? c.CLOUDINARY_CLOUD_NAME && c.CLOUDINARY_API_KEY && c.CLOUDINARY_API_SECRET
          ? "cloudinary"
          : "local"
        : c.STORAGE_DRIVER,
    cloudinary: {
      cloudName: c.CLOUDINARY_CLOUD_NAME ?? "",
      apiKey: c.CLOUDINARY_API_KEY ?? "",
      apiSecret: c.CLOUDINARY_API_SECRET ?? "",
      folder: c.CLOUDINARY_FOLDER,
    },
    uploadDir: c.UPLOAD_DIR,
    urlPrefix: c.UPLOAD_URL_PREFIX,
    maxFiles: c.UPLOAD_MAX_FILES,
    maxFileSizeBytes: c.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
    allowedMime: c.UPLOAD_ALLOWED_MIME.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean),
  },
  cache: {
    enabled: c.CACHE_ENABLED && !!c.REDIS_URL,
    redisUrl: c.REDIS_URL ?? "",
    ttlSeconds: c.CACHE_TTL_SECONDS,
  },
  logLevel: c.LOG_LEVEL,
} as const;
