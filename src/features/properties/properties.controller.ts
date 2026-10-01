import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as propertyService from "./properties.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

function actorOf(req: AuthenticatedRequest) {
  if (!req.user) throw new Error("Authentication required");
  return { id: req.user.id, role: req.user.role };
}

export const listProperties = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await propertyService.listProperties({
      status: query.status as never | undefined,
      city: query.city as string | undefined,
      state: query.state as string | undefined,
      country: query.country as string | undefined,
      ownerId: query.ownerId as string | undefined,
      search: query.search as string | undefined,
      published: query.published === "true",
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

export const getProperty = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const property = await propertyService.getProperty(req.params.id as string);
    res.json(successResponse(property));
  } catch (err) {
    next(err);
  }
};

export const createProperty = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const property = await propertyService.createProperty(req.body as never, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(property, { message: "Property created", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const updateProperty = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const property = await propertyService.updateProperty(req.params.id as string, req.body as never, { id: req.user!.id, role: req.user!.role });
    res.json(successResponse(property, { message: "Property updated" }));
  } catch (err) {
    next(err);
  }
};

export const deleteProperty = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    await propertyService.deleteProperty(req.params.id as string, { id: req.user!.id, role: req.user!.role });
    res.json(successResponse(null, { message: "Property deleted" }));
  } catch (err) {
    next(err);
  }
};

export const addAmenity = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const { amenityId } = req.body as { amenityId: string };
    await propertyService.addAmenityToProperty(req.params.id as string, amenityId, { id: req.user!.id, role: req.user!.role });
    res.json(successResponse(null, { message: "Amenity added to property" }));
  } catch (err) {
    next(err);
  }
};

export const removeAmenity = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    await propertyService.removeAmenityFromProperty(req.params.id as string, req.params.amenityId as string, { id: req.user!.id, role: req.user!.role });
    res.json(successResponse(null, { message: "Amenity removed from property" }));
  } catch (err) {
    next(err);
  }
};

export { actorOf };
