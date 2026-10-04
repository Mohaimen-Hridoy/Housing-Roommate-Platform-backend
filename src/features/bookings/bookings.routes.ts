import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { bookingCreateSchema, bookingApproveSchema, bookingFilterSchema, bookingCancelSchema } from "./bookings.schema";
import {
  createBooking,
  listBookings,
  getBooking,
  approveBooking,
  rejectBooking,
  cancelBooking,
  deleteBooking,
  getBookingPayments,
  createCheckout,
  getCheckoutReturn,
} from "./bookings.controller";

export const bookingsRouter = Router();

// Stripe redirects the payer here after checkout, when the browser holds no
// bearer token, so these two are registered ahead of the auth middleware.
bookingsRouter.get("/:id/success", getCheckoutReturn("success"));
bookingsRouter.get("/:id/cancel", getCheckoutReturn("cancel"));

bookingsRouter.use(authenticate, authorize(Role.OWNER, Role.TENANT, Role.ADMIN));

bookingsRouter.get("/", validate({ query: bookingFilterSchema }), listBookings);
bookingsRouter.get("/mine", validate({ query: bookingFilterSchema }), listBookings);
bookingsRouter.post("/", validate({ body: bookingCreateSchema }), createBooking);
bookingsRouter.get("/:id", getBooking);
bookingsRouter.get("/:id/payments", getBookingPayments);
bookingsRouter.post("/:id/checkout", createCheckout);
bookingsRouter.patch("/:id/approve", authorize(Role.OWNER, Role.ADMIN), validate({ body: bookingApproveSchema }), approveBooking);
bookingsRouter.patch("/:id/reject", authorize(Role.OWNER, Role.ADMIN), rejectBooking);
bookingsRouter.patch("/:id/cancel", validate({ body: bookingCancelSchema }), cancelBooking);
bookingsRouter.delete("/:id", deleteBooking);
