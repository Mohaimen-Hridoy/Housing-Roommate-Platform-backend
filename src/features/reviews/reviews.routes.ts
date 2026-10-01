import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { reviewCreateSchema, reviewFilterSchema } from "./reviews.schema";
import { listReviews, getReview, createReview, deleteReview } from "./reviews.controller";

export const reviewsRouter = Router();

reviewsRouter.get("/", validate({ query: reviewFilterSchema }), listReviews);
reviewsRouter.get("/:id", getReview);
reviewsRouter.post("/", authenticate, authorize(Role.OWNER, Role.TENANT, Role.ADMIN), validate({ body: reviewCreateSchema }), createReview);
reviewsRouter.delete("/:id", authenticate, deleteReview);
