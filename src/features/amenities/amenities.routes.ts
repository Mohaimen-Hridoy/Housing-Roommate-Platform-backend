import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { amenityFilterSchema, amenityCreateSchema } from "./amenities.schema";
import { listAmenities, createAmenity, deleteAmenity } from "./amenities.controller";

export const amenitiesRouter = Router();

amenitiesRouter.get("/", validate({ query: amenityFilterSchema }), listAmenities);
amenitiesRouter.post("/", authenticate, authorize(Role.ADMIN), validate({ body: amenityCreateSchema }), createAmenity);
amenitiesRouter.delete("/:id", authenticate, authorize(Role.ADMIN), deleteAmenity);
