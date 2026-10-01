import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as auditService from "./audit.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

export const listAuditLogs = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const query = req.query as Record<string, unknown>;
    const result = await auditService.listAuditLogs(
      {
        action: (query.action as string) || undefined,
        entityType: query.entityType as string | undefined,
        entityId: query.entityId as string | undefined,
        actorId: query.actorId as string | undefined,
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

export const getAuditLog = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const log = await auditService.getAuditLog(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(log));
  } catch (err) {
    next(err);
  }
};
