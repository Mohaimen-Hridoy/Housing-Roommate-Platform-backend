import { z } from "zod";
import { BookingStatus } from "@prisma/client";

export const bookingCreateSchema = z
  .object({
    roomId: z.string().min(1, "roomId is required"),
    startDate: z.coerce.date({ required_error: "startDate is required" }),
    endDate: z.coerce.date({ required_error: "endDate is required" }),
    message: z.string().max(1000).optional(),
  })
  .refine((data) => data.endDate > data.startDate, { message: "endDate must be after startDate", path: ["endDate"] })
  .refine((data) => data.startDate > new Date(Date.now() - 24 * 60 * 60 * 1000), {
    message: "startDate must be in the future",
    path: ["startDate"],
  });

export const bookingApproveSchema = z.object({
  endDate: z.coerce.date().optional(),
});

export const bookingFilterSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  tenantId: z.string().optional(),
  propertyId: z.string().optional(),
  roomId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "startDate", "endDate", "totalAmount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const bookingCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});
