import { z } from "zod";
import { PaymentStatus, PaymentProvider } from "@prisma/client";

export const paymentFilterSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  provider: z.nativeEnum(PaymentProvider).optional(),
  bookingId: z.string().optional(),
  tenantId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "amount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const refundSchema = z.object({
  amount: z.coerce.number().positive().optional(),
});

export { PaymentStatus, PaymentProvider };
