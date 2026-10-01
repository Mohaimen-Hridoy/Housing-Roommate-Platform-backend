import { Prisma, Role, RoomStatus, BookingStatus, RoomFacing } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ForbiddenError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { buildMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

const roomSelect = {
  id: true,
  propertyId: true,
  title: true,
  description: true,
  area: true,
  rent: true,
  currency: true,
  deposit: true,
  bedrooms: true,
  bathrooms: true,
  facing: true,
  availableFrom: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export interface ListRoomsInput {
  propertyId?: string;
  status?: RoomStatus;
  availableFrom?: Date;
  minRent?: number;
  maxRent?: number;
  minArea?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  facing?: RoomFacing;
  currency?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface RoomCreateInput {
  title: string;
  description?: string;
  area?: number;
  rent: number;
  currency?: string;
  deposit?: number;
  bedrooms?: number;
  bathrooms?: number;
  facing?: RoomFacing;
  availableFrom?: Date;
  status?: RoomStatus;
}

export async function listRooms(input: ListRoomsInput) {
  const allowedSort = ["createdAt", "rent", "area", "availableFrom"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.RoomWhereInput = {
    deletedAt: null,
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.facing ? { facing: input.facing } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
    ...(input.availableFrom ? { availableFrom: { gte: input.availableFrom } } : {}),
    ...(input.minRent !== undefined ? { rent: { gte: input.minRent } } : {}),
    ...(input.maxRent !== undefined ? { rent: { lte: input.maxRent } } : {}),
    ...(input.minArea !== undefined ? { area: { gte: input.minArea } } : {}),
    ...(input.minBedrooms !== undefined ? { bedrooms: { gte: input.minBedrooms } } : {}),
    ...(input.minBathrooms !== undefined ? { bathrooms: { gte: input.minBathrooms } } : {}),
    ...(input.search ? { OR: [{ title: { contains: input.search } }, { description: { contains: input.search } }] } : {}),
  };

  const [totalItems, rows] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: { ...roomSelect, property: { select: { id: true, title: true, city: true } } } }),
  ]);

  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function getRoom(id: string) {
  const room = await prisma.room.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...roomSelect,
      property: { select: { id: true, title: true, city: true, status: true } },
    },
  });
  if (!room) throw new NotFoundError("Room not found");
  return room;
}

async function loadRoomOwner(id: string): Promise<{ ownerId: string }> {
  const room = await prisma.room.findFirst({
    where: { id, deletedAt: null },
    select: { property: { select: { ownerId: true } } },
  });
  if (!room) throw new NotFoundError("Room not found");
  return { ownerId: room.property.ownerId };
}

async function assertOwner(roomId: string, actor: Actor) {
  const { ownerId } = await loadRoomOwner(roomId);
  if (actor.role !== Role.ADMIN && ownerId !== actor.id) throw new ForbiddenError("You do not own this room");
}

export async function createRoom(propertyId: string, input: RoomCreateInput, owner: Actor) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { ownerId: true, id: true } });
  if (!property) throw new NotFoundError("Property not found");
  if (owner.role !== Role.ADMIN && property.ownerId !== owner.id) throw new ForbiddenError("You do not own this property");

  const room = await prisma.room.create({
    data: {
      property: { connect: { id: propertyId } },
      title: input.title,
      description: input.description,
      area: input.area,
      rent: input.rent,
      currency: input.currency ?? "usd",
      deposit: input.deposit,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      facing: input.facing,
      availableFrom: input.availableFrom,
      status: input.status ?? RoomStatus.AVAILABLE,
    },
    select: roomSelect,
  });
  await writeAuditLog({ action: "ROOM_CREATED", actor: owner, entityId: room.id, entityType: "room", after: room });
  return room;
}

export async function updateRoom(id: string, input: Partial<RoomCreateInput>, actor: Actor) {
  await assertOwner(id, actor);
  const updated = await prisma.room.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      area: input.area,
      rent: input.rent,
      currency: input.currency,
      deposit: input.deposit,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      facing: input.facing,
      availableFrom: input.availableFrom,
      status: input.status,
    },
    select: roomSelect,
  });
  await writeAuditLog({ action: "ROOM_UPDATED", actor, entityId: id, entityType: "room", after: updated });
  return updated;
}

export async function updateRoomStatus(id: string, status: RoomStatus, actor: Actor) {
  await assertOwner(id, actor);
  const updated = await prisma.room.update({ where: { id }, data: { status }, select: roomSelect });
  await writeAuditLog({ action: "ROOM_UPDATED", actor, entityId: id, entityType: "room", after: { status } });
  return updated;
}

export async function deleteRoom(id: string, actor: Actor) {
  await assertOwner(id, actor);
  const room = await prisma.room.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true, rent: true, status: true } });
  await writeAuditLog({ action: "ROOM_DELETED", actor, entityId: id, entityType: "room", before: room });
  return { id, deleted: true };
}

export async function getRoomOccupancy(id: string) {
  const room = await prisma.room.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      bookings: {
        where: { status: { in: [BookingStatus.APPROVED] } },
        select: {
          id: true,
          tenant: { select: { id: true, name: true } },
          startDate: true,
          endDate: true,
          status: true,
        },
      },
    },
  });
  if (!room) throw new NotFoundError("Room not found");
  return room;
}
