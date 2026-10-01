import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as paymentService from "./payments.service";
import { successResponse } from "../../common/apiResponse";

type Res = Response;

export const listPayments = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await paymentService.listPayments(
      {
        status: (query.status as string) as never,
        provider: (query.provider as string) as never,
        bookingId: query.bookingId as string | undefined,
        tenantId: query.tenantId as string | undefined,
        from: query.from ? new Date(query.from as string) : undefined,
        to: query.to ? new Date(query.to as string) : undefined,
        page: Number(query.page) || 1,
        pageSize: Number(query.pageSize) || 20,
        sortBy: (query.sortBy as string) || "createdAt",
        sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
      },
      { id: req.user!.id, role: req.user!.role }
    );
    res.json(successResponse(result.rows, { meta: result.meta }));
  } catch (err) {
    next(err);
  }
};

export const getPayment = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const payment = await paymentService.getPayment(req.params.id as string, { id: req.user!.id, role: req.user!.role });
    res.json(successResponse(payment));
  } catch (err) {
    next(err);
  }
};

export const refundPayment = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const payment = await paymentService.refundPayment(req.params.id as string, req.body as { amount?: number }, { id: req.user!.id, role: req.user!.role });
    res.json(successResponse(payment, { message: "Payment refunded" }));
  } catch (err) {
    next(err);
  }
};
