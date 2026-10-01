import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as roomService from "./rooms.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

export const listRooms = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await roomService.listRooms({
      propertyId: query.propertyId as string | undefined,
      status: (query.status as string) as never,
      availableFrom: query.availableFrom ? new Date(query.availableFrom as string) : undefined,
      minRent: query.minRent ? Number(query.minRent) : undefined,
      maxRent: query.maxRent ? Number(query.maxRent) : undefined,
      minArea: query.minArea ? Number(query.minArea) : undefined,
      minBedrooms: query.minBedrooms ? Number(query.minBedrooms) : undefined,
      minBathrooms: query.minBathrooms ? Number(query.minBathrooms) : undefined,
      facing: (query.facing as string) as never,
      currency: query.currency as string | undefined,
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

export const listPropertyRooms = listRooms;

export const getRoom = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const room = await roomService.getRoom(req.params.id as string);
    res.json(successResponse(room));
  } catch (err) {
    next(err);
  }
};

export const createRoom = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const body = req.body as { propertyId?: string };
    const propertyId = req.params.propertyId ?? body.propertyId;
    if (!propertyId) {
      res.status(400).json(errorResponse({ message: "propertyId is required", statusCode: 400 }));
      return;
    }
    const room = await roomService.createRoom(propertyId, req.body as never, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(room, { message: "Room created", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const updateRoom = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const room = await roomService.updateRoom(req.params.id as string, req.body as never, { id: req.user.id, role: req.user.role });
    res.json(successResponse(room, { message: "Room updated" }));
  } catch (err) {
    next(err);
  }
};

export const updateRoomStatus = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const { status } = req.body as { status?: string };
    const room = await roomService.updateRoomStatus(req.params.id as string, status as never, { id: req.user.id, role: req.user.role });
    res.json(successResponse(room, { message: "Room status updated" }));
  } catch (err) {
    next(err);
  }
};

export const deleteRoom = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await roomService.deleteRoom(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Room deleted" }));
  } catch (err) {
    next(err);
  }
};

export const getRoomOccupancy = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const occupancy = await roomService.getRoomOccupancy(req.params.id as string);
    res.json(successResponse(occupancy));
  } catch (err) {
    next(err);
  }
};
