import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ConflictError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { buildMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

const amenitySelect = {
  id: true,
  name: true,
  icon: true,
  createdAt: true,
  updatedAt: true,
};

export async function listAmenities(input: { search?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: "asc" | "desc" }) {
  const sortField = ["createdAt", "name"].includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.AmenityWhereInput = input.search ? { OR: [{ name: { contains: input.search } }, { icon: { contains: input.search } }] } : {};
  const [totalItems, rows] = await Promise.all([prisma.amenity.count({ where }), prisma.amenity.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: amenitySelect })]);
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function createAmenity(input: { name: string; icon?: string }, actor: Actor) {
  try {
    const amenity = await prisma.amenity.create({ data: { name: input.name, icon: input.icon }, select: amenitySelect });
    await writeAuditLog({ action: "AMENITY_CREATED", actor, entityId: amenity.id, entityType: "amenity", after: amenity });
    return amenity;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("Amenity already exists");
    throw err;
  }
}

export async function deleteAmenity(id: string, actor: Actor) {
  const amenity = await prisma.amenity.findUnique({ where: { id }, select: amenitySelect });
  if (!amenity) throw new NotFoundError("Amenity not found");
  await prisma.amenity.delete({ where: { id } });
  await writeAuditLog({ action: "AMENITY_DELETED", actor, entityId: id, entityType: "amenity", before: amenity });
  return { id, deleted: true };
}
