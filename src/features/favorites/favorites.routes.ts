import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { favoriteCreateSchema, favoriteFilterSchema } from "./favorites.schema";
import { listFavorites, createFavorite, deleteFavorite, deleteFavoriteByProperty } from "./favorites.controller";

export const favoritesRouter = Router();

favoritesRouter.use(authenticate, authorize(Role.TENANT, Role.OWNER, Role.ADMIN));

favoritesRouter.get("/", validate({ query: favoriteFilterSchema }), listFavorites);
favoritesRouter.post("/", validate({ body: favoriteCreateSchema }), createFavorite);
favoritesRouter.delete("/:id", deleteFavorite);
favoritesRouter.delete("/property/:propertyId", deleteFavoriteByProperty);
