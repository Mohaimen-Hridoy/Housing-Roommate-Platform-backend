import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as reviewService from "./reviews.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

export const listReviews = async (req: Request, res: Res, next: NextFunction) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await reviewService.listReviews({
      subject: (query.subject as string) as never,
      reviewableId: query.reviewableId as string | undefined,
      authorId: query.authorId as string | undefined,
      minRating: query.minRating ? Number(query.minRating) : undefined,
      maxRating: query.maxRating ? Number(query.maxRating) : undefined,
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

export const getReview = async (req: Request, res: Res, next: NextFunction) => {
  try {
    const review = await reviewService.getReview(req.params.id as string);
    res.json(successResponse(review));
  } catch (err) {
    next(err);
  }
};

export const createReview = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const review = await reviewService.createReview(req.body as never, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(review, { message: "Review created", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const deleteReview = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await reviewService.deleteReview(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Review deleted" }));
  } catch (err) {
    next(err);
  }
};
