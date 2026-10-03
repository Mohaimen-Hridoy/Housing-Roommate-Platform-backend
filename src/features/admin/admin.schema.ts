import { z } from "zod";

export const adminStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});