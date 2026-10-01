import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { ForbiddenError, NotFoundError } from "../../common/errors";
import { buildMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

export interface ListAuditInput {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function listAuditLogs(input: ListAuditInput, actor: Actor) {
  if (actor.role !== Role.ADMIN) throw new ForbiddenError("Admin access required");
  const sortField = "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.AuditLogWhereInput = {
    ...(input.action ? { action: input.action as never } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.from ? { createdAt: { gte: input.from } } : {}),
  };
  if (input.from && input.to) where.createdAt = { gte: input.from, lte: input.to };

  const [totalItems, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, include: { actor: { select: { id: true, email: true, role: true } } } }),
  ]);
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function getAuditLog(id: string, actor: Actor) {
  if (actor.role !== Role.ADMIN) throw new ForbiddenError("Admin access required");
  const log = await prisma.auditLog.findUnique({ where: { id }, include: { actor: { select: { id: true, email: true, role: true } } } });
  if (!log) throw new NotFoundError("Audit log not found");
  return log;
}
