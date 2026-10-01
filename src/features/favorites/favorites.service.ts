import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ConflictError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { buildMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

const favoriteSelect = {
  id: true,
  userId: true,
  propertyId: true,
  createdAt: true,
  property: { select: { id: true, title: true, city: true, status: true } },
};

export async function listFavorites(input: { propertyId?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: "asc" | "desc" }, actor: Actor) {
  const allowedSort = ["createdAt"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.FavoriteWhereInput = { userId: actor.id, ...(input.propertyId ? { propertyId: input.propertyId } : {}) };
  const [totalItems, rows] = await Promise.all([
    prisma.favorite.count({ where }),
    prisma.favorite.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: favoriteSelect }),
  ]);
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function createFavorite(input: { propertyId: string }, actor: Actor) {
  const property = await prisma.property.findFirst({ where: { id: input.propertyId, deletedAt: null } });
  if (!property) throw new NotFoundError("Property not found");
  try {
    const fav = await prisma.favorite.create({ data: { userId: actor.id, propertyId: input.propertyId }, select: favoriteSelect });
    await writeAuditLog({ action: "FAVORITE_CREATED", actor, entityId: fav.id, entityType: "favorite", after: { propertyId: fav.propertyId } });
    return fav;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("Already favorited");
    throw err;
  }
}

export async function deleteFavorite(id: string, actor: Actor) {
  const fav = await prisma.favorite.findFirst({ where: { id, userId: actor.id } });
  if (!fav) throw new NotFoundError("Favorite not found");
  await prisma.favorite.delete({ where: { id } });
  await writeAuditLog({ action: "FAVORITE_DELETED", actor, entityId: id, entityType: "favorite", after: { deleted: true } });
  return { id, deleted: true };
}

export async function deleteFavoriteByProperty(propertyId: string, actor: Actor) {
  const fav = await prisma.favorite.findFirst({ where: { propertyId, userId: actor.id } });
  if (!fav) throw new NotFoundError("Favorite not found");
  await prisma.favorite.delete({ where: { id: fav.id } });
  return { id: fav.id, deleted: true };
}
