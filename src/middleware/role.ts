import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../common/errors";
import { AuthenticatedRequest } from "./auth";

export function authorize(...allowed: Role[]): (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void {
  if (allowed.length === 0) allowed.push(...Object.values(Role));
  const set = new Set(allowed);
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError("Authentication required"));
    if (!set.has(req.user.role)) return next(new ForbiddenError("Insufficient role"));
    next();
  };
}

export function requireOwnerOrAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError("Authentication required"));
  if (req.user.role !== Role.OWNER && req.user.role !== Role.ADMIN) {
    return next(new ForbiddenError("Owner or Admin access required"));
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError("Authentication required"));
  if (req.user.role !== Role.ADMIN) return next(new ForbiddenError("Admin access required"));
  next();
}
