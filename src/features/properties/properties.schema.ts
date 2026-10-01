import { z } from "zod";

export const propertyFilterSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  ownerId: z.string().optional(),
  search: z.string().optional(),
  published: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : undefined), z.boolean().optional()),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "title", "publishedAt", "city"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const propertyCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  address: z.string().min(1, "Address is required").max(300),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("US"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  amenities: z.array(z.string()).optional(),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

export const propertyAmenitySchema = z.object({
  amenityId: z.string().min(1),
});
