import { z } from "zod";

export const favoriteCreateSchema = z.object({
  propertyId: z.string().min(1),
});

export const favoriteFilterSchema = z.object({
  propertyId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
