import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { successResponse } from "../../common/apiResponse";
import { getPlatformStats, getOwnerDashboard } from "./admin.stats.service";

type Res = Response;

export const getStats = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const stats = await getPlatformStats({ days: Number(req.query.days) || undefined });
    res.json(successResponse(stats, { message: "Platform statistics" }));
  } catch (err) {
    next(err);
  }
};

export const getDashboard = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const dashboard = await getOwnerDashboard(req.user!.id);
    res.json(successResponse(dashboard, { message: "Owner dashboard" }));
  } catch (err) {
    next(err);
  }
};