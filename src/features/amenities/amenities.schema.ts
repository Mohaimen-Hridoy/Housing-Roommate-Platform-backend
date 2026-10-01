import { z } from "zod";

export const amenityFilterSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const amenityCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  icon: z.string().max(50).optional(),
});

export const amenityUpdateSchema = amenityCreateSchema.partial();
