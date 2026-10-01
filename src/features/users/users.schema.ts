import { z } from "zod";

export const userFilterSchema = z.object({
  role: z.enum(["OWNER", "TENANT", "ADMIN"]).optional(),
  isVerified: z.preprocess((v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : undefined), z.boolean().optional()),
  name: z.string().optional(),
  email: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "TENANT", "ADMIN"]).optional(),
  isVerified: z.boolean().optional(),
});

export const adminSetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
