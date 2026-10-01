import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { propertyFilterSchema, propertyCreateSchema, propertyUpdateSchema, propertyAmenitySchema } from "./properties.schema";
import { listProperties, getProperty, createProperty, updateProperty, deleteProperty, addAmenity, removeAmenity } from "./properties.controller";

export const propertiesRouter = Router();

propertiesRouter.get("/", validate({ query: propertyFilterSchema }), listProperties);
propertiesRouter.get("/:id", getProperty);
propertiesRouter.post("/", authenticate, authorize(Role.OWNER, Role.ADMIN), validate({ body: propertyCreateSchema }), createProperty);
propertiesRouter.patch("/:id", authenticate, authorize(Role.OWNER, Role.ADMIN), validate({ body: propertyUpdateSchema }), updateProperty);
propertiesRouter.delete("/:id", authenticate, authorize(Role.OWNER, Role.ADMIN), deleteProperty);
propertiesRouter.post("/:id/amenities", authenticate, authorize(Role.OWNER, Role.ADMIN), validate({ body: propertyAmenitySchema }), addAmenity);
propertiesRouter.delete("/:id/amenities/:amenityId", authenticate, authorize(Role.OWNER, Role.ADMIN), removeAmenity);
