import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { auditFilterSchema } from "./audit.schema";
import { listAuditLogs, getAuditLog } from "./audit.controller";

export const auditRouter = Router();

auditRouter.use(authenticate, authorize(Role.ADMIN));

auditRouter.get("/", validate({ query: auditFilterSchema }), listAuditLogs);
auditRouter.get("/:id", getAuditLog);
