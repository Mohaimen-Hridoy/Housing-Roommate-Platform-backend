import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { paymentFilterSchema, refundSchema } from "./payments.schema";
import { listPayments, getPayment, refundPayment } from "./payments.controller";

export const paymentsRouter = Router();

paymentsRouter.use(authenticate, authorize(Role.OWNER, Role.TENANT, Role.ADMIN));

paymentsRouter.get("/", authorize(Role.ADMIN, Role.OWNER, Role.TENANT), validate({ query: paymentFilterSchema }), listPayments);
paymentsRouter.get("/:id", getPayment);
paymentsRouter.post("/:id/refund", authorize(Role.ADMIN), validate({ body: refundSchema }), refundPayment);
