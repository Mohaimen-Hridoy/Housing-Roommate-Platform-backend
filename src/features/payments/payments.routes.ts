import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { paymentFilterSchema, refundSchema } from "./payments.schema";
import { listPayments, getPayment, refundPayment } from "./payments.controller";

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

// Listing every payment is an administrative view; tenants and owners read
// their own payments through GET /payments/:id and GET /bookings/:id/payments.
paymentsRouter.get("/", authorize(Role.ADMIN), validate({ query: paymentFilterSchema }), listPayments);
paymentsRouter.get("/:id", getPayment);
paymentsRouter.post("/:id/refund", authorize(Role.ADMIN), validate({ body: refundSchema }), refundPayment);
