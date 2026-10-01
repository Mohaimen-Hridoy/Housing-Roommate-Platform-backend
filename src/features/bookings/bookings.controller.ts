import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as bookingService from "./bookings.service";
import { successResponse, errorResponse } from "../../common/apiResponse";
import { BookingListItem } from "./bookings.service";

type Res = Response;

export const createBooking = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const booking = await bookingService.createBooking(req.body as never, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(booking, { message: "Booking created", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const listBookings = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const query = req.query as Record<string, unknown>;
    const result = await bookingService.listBookings(
      {
        status: (query.status as string) as never,
        tenantId: query.tenantId as string | undefined,
        propertyId: query.propertyId as string | undefined,
        roomId: query.roomId as string | undefined,
        from: query.from ? new Date(query.from as string) : undefined,
        to: query.to ? new Date(query.to as string) : undefined,
        page: Number(query.page) || 1,
        pageSize: Number(query.pageSize) || 20,
        sortBy: (query.sortBy as string) || "createdAt",
        sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
      },
      { id: req.user.id, role: req.user.role }
    );
    res.json(successResponse(result.rows, { meta: result.meta }));
  } catch (err) {
    next(err);
  }
};

export const getBooking = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const booking = await bookingService.getBookingById(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(booking));
  } catch (err) {
    next(err);
  }
};

export const approveBooking = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const body = req.body as { endDate?: string };
    const booking = await bookingService.approveBooking(req.params.id as string, { id: req.user.id, role: req.user.role }, { endDate: body.endDate ? new Date(body.endDate) : undefined });
    res.json(successResponse(booking, { message: "Booking approved" }));
  } catch (err) {
    next(err);
  }
};

export const rejectBooking = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const booking = await bookingService.rejectBooking(req.params.id as string, { id: req.user.id, role: req.user.role }, (req.body as { reason?: string }).reason);
    res.json(successResponse(booking, { message: "Booking rejected" }));
  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const booking = await bookingService.cancelBooking(req.params.id as string, { id: req.user.id, role: req.user.role }, (req.body as { reason?: string }).reason);
    res.json(successResponse(booking, { message: "Booking cancelled" }));
  } catch (err) {
    next(err);
  }
};

export const deleteBooking = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await bookingService.deleteBooking(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Booking deleted" }));
  } catch (err) {
    next(err);
  }
};

export const getBookingPayments = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const payments = await bookingService.getBookingPayments(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(payments));
  } catch (err) {
    next(err);
  }
};

export const createCheckout = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const checkout = await bookingService.createBookingCheckout(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(checkout, { message: "Checkout created" }));
  } catch (err) {
    next(err);
  }
};

export { BookingListItem };
