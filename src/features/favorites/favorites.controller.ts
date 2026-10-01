import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as favoriteService from "./favorites.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

export const listFavorites = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const query = req.query as Record<string, unknown>;
    const result = await favoriteService.listFavorites(
      { propertyId: query.propertyId as string | undefined, page: Number(query.page) || 1, pageSize: Number(query.pageSize) || 20, sortBy: (query.sortBy as string) || "createdAt", sortOrder: (query.sortOrder as "asc" | "desc") || "desc" },
      { id: req.user.id, role: req.user.role }
    );
    res.json(successResponse(result.rows, { meta: result.meta }));
  } catch (err) {
    next(err);
  }
};

export const createFavorite = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const fav = await favoriteService.createFavorite(req.body as { propertyId: string }, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(fav, { message: "Favorited", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const deleteFavorite = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await favoriteService.deleteFavorite(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Favorite removed" }));
  } catch (err) {
    next(err);
  }
};

export const deleteFavoriteByProperty = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await favoriteService.deleteFavoriteByProperty(req.params.propertyId as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Favorite removed" }));
  } catch (err) {
    next(err);
  }
};
