import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as amenityService from "./amenities.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

export const listAmenities = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await amenityService.listAmenities({
      search: query.search as string | undefined,
      page: Number(query.page) || 1,
      pageSize: Number(query.pageSize) || 20,
      sortBy: (query.sortBy as string) || "createdAt",
      sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    });
    res.json(successResponse(result.rows, { meta: result.meta }));
  } catch (err) {
    next(err);
  }
};

export const createAmenity = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const amenity = await amenityService.createAmenity(req.body as { name: string; icon?: string }, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(amenity, { message: "Amenity created", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const deleteAmenity = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await amenityService.deleteAmenity(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Amenity deleted" }));
  } catch (err) {
    next(err);
  }
};
