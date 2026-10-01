import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { roomFilterSchema, roomCreateSchema, roomUpdateSchema, roomStatusSchema } from "./rooms.schema";
import {
  listRooms,
  listPropertyRooms,
  getRoom,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getRoomOccupancy,
} from "./rooms.controller";

export const roomsRouter = Router({ mergeParams: true });
export const propertyRoomsRouter = Router({ mergeParams: true });

// Property-scoped room routes: /properties/:propertyId/rooms
propertyRoomsRouter.get("/", validate({ query: roomFilterSchema }), listPropertyRooms);
propertyRoomsRouter.post("/", authenticate, authorize(Role.OWNER, Role.ADMIN), validate({ body: roomCreateSchema }), createRoom);

// Flat room routes: /rooms
roomsRouter.get("/", validate({ query: roomFilterSchema }), listRooms);
roomsRouter.get("/:id", getRoom);
roomsRouter.get("/:id/occupancy", getRoomOccupancy);
roomsRouter.patch("/:id", authenticate, authorize(Role.OWNER, Role.ADMIN), validate({ body: roomUpdateSchema }), updateRoom);
roomsRouter.patch("/:id/status", authenticate, authorize(Role.OWNER, Role.ADMIN), validate({ body: roomStatusSchema }), updateRoomStatus);
roomsRouter.delete("/:id", authenticate, authorize(Role.OWNER, Role.ADMIN), deleteRoom);
