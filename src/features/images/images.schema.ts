import { z } from "zod";

export const imageIdParamSchema = z.object({
  id: z.string().min(1, "Image id is required"),
});

export const setPrimaryBodySchema = z.object({}).strict();