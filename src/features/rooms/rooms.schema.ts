import { z } from "zod";
import { RoomFacing, RoomStatus } from "@prisma/client";
import { currencyList } from "../../common/currencies";

export const roomFilterSchema = z.object({
  status: z.enum(["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"]).optional(),
  availableFrom: z.coerce.date().optional(),
  minRent: z.coerce.number().optional(),
  maxRent: z.coerce.number().optional(),
  minArea: z.coerce.number().optional(),
  minBedrooms: z.coerce.number().int().min(0).optional(),
  minBathrooms: z.coerce.number().int().min(0).optional(),
  facing: z.nativeEnum(RoomFacing).optional(),
  currency: z.enum(currencyList).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "rent", "area", "availableFrom"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const roomCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  area: z.coerce.number().positive().optional(),
  rent: z.coerce.number().positive("Rent must be a positive number"),
  currency: z.enum(currencyList).default("usd"),
  deposit: z.coerce.number().nonnegative().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  facing: z.nativeEnum(RoomFacing).optional(),
  availableFrom: z.coerce.date().optional(),
  status: z.enum(["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"]).default("AVAILABLE"),
});

export const roomUpdateSchema = roomCreateSchema.partial();
export const roomStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"]),
});

export { RoomFacing, RoomStatus };
