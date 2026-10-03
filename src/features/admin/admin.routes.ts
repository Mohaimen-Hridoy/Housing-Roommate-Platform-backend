import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import { adminStatsQuerySchema } from "./admin.schema";
import { getStats } from "./admin.controller";

export const adminRouter = Router();

adminRouter.use(authenticate, authorize(Role.ADMIN));

adminRouter.get("/stats", validate({ query: adminStatsQuerySchema }), getStats);