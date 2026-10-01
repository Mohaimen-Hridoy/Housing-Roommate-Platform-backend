import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../utils/prisma";
import { paginateQuery, buildMeta } from "../../utils/pagination";
import { NotFoundError, ConflictError, BadRequestError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { env } from "../../config";

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  image: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
};

export interface ListUsersInput {
  role?: Role;
  isVerified?: boolean;
  name?: string;
  email?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function listUsers(input: ListUsersInput) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(input.role ? { role: input.role } : {}),
    ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
    ...(input.name ? { name: { contains: input.name } } : {}),
    ...(input.email ? { email: { contains: input.email } } : {}),
  };
  const { take, skip, orderBy, page, pageSize, totalItems } = await paginateQuery(
    prisma.user,
    where,
    { page: input.page ?? 1, pageSize: input.pageSize ?? 20, sortBy: input.sortBy ?? "createdAt", sortOrder: input.sortOrder ?? "desc" }
  );
  const rows = await prisma.user.findMany({ where, orderBy, skip, take, select: userSelect });
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize, orderBy }, totalItems) } };
}

export async function getUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function updateUser(id: string, input: { name?: string; phone?: string }, actor: { id: string; role: Role }) {
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("User not found");
  if (input.phone && input.phone !== existing.phone) {
    const conflict = await prisma.user.findFirst({ where: { phone: input.phone, deletedAt: null, NOT: { id } } });
    if (conflict) throw new ConflictError("Phone number already in use");
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { name: input.name, phone: input.phone },
    select: userSelect,
  });
  await writeAuditLog({ action: "USER_UPDATED", actor, entityId: id, entityType: "user", before: { email: existing.email }, after: { email: updated.email, name: updated.name } });
  return updated;
}

export async function changeUserRole(id: string, role: Role, actor: { id: string; role: Role }) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError("User not found");
  if (user.role === role && user.id === actor.id) throw new BadRequestError("Cannot change your own role in this context");
  const updated = await prisma.user.update({ where: { id }, data: { role }, select: userSelect });
  await writeAuditLog({ action: "ROLE_ASSIGNED", actor, entityId: id, entityType: "user", after: { role: updated.role } });
  return updated;
}

export async function changePasswordAdmin(id: string, password: string, actor: { id: string; role: Role }) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError("User not found");
  const hash = await bcrypt.hash(password, env.bcryptRounds);
  await prisma.user.update({ where: { id }, data: { passwordHash: hash, refreshTokenHash: null } });
  await writeAuditLog({ action: "USER_UPDATED", actor, entityId: id, entityType: "user", after: { passwordChanged: true } });
}

export async function deleteUser(id: string, actor: { id: string; role: Role }) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError("User not found");
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), refreshTokenHash: null, email: `deleted_${user.id}@deleted.local` } });
  await writeAuditLog({ action: "USER_DELETED", actor, entityId: id, entityType: "user", before: { email: user.email, role: user.role } });
  return { id, deleted: true };
}

export async function restoreUser(id: string, actor: { id: string; role: Role }) {
  const user = await prisma.user.findFirst({ where: { id } });
  if (!user || !user.deletedAt) throw new NotFoundError("User not found");
  await prisma.user.update({ where: { id }, data: { deletedAt: null } });
  await writeAuditLog({ action: "USER_UPDATED", actor, entityId: id, entityType: "user", after: { restored: true } });
  return { id, restored: true };
}

export { userSelect };
