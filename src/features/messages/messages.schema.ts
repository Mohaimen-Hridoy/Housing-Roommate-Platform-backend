import { z } from "zod";

export const messageCreateSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().min(1, "Message body is required").max(5000),
  propertyId: z.string().optional(),
});

export const messageFilterSchema = z.object({
  folder: z.enum(["inbox", "sent"]).default("inbox"),
  propertyId: z.string().optional(),
  read: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : undefined), z.boolean().optional()),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const messageReadSchema = z.object({});
