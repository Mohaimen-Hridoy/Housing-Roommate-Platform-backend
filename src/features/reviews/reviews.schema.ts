import { z } from "zod";
import { ReviewSubject } from "@prisma/client";

export const reviewCreateSchema = z.object({
  subject: z.enum(["ROOM", "PROPERTY"]),
  reviewableId: z.string().min(1),
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  comment: z.string().max(2000).optional(),
});

export const reviewFilterSchema = z.object({
  subject: z.enum(["ROOM", "PROPERTY"]).optional(),
  reviewableId: z.string().optional(),
  authorId: z.string().optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "rating"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export { ReviewSubject };
