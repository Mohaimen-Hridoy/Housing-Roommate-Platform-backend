import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { ApiError } from "../common/errors";

export type AuditActor = { id?: string; role?: string; ip?: string | null; userAgent?: string | null } | null;

export interface AuditOptions {
  action: string;
  actor?: AuditActor;
  entityId?: string | null;
  entityType?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(data: AuditOptions): Promise<void> {
  try {
    const actorId = data.actor?.id ?? null;
    const jsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
      if (value === undefined) return undefined;
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    };

    const before = jsonValue(data.before);
    const after = jsonValue(data.after);
    await prisma.auditLog.create({
      data: {
        action: data.action as never,
        actorId,
        entityId: data.entityId?.toString() ?? null,
        entityType: data.entityType ?? null,
        ...(before === undefined ? {} : { before }),
        ...(after === undefined ? {} : { after }),
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof ApiError) throw err;
    throw new Error(`audit log write failed: ${msg}`);
  }
}

export function auditContextFromReq(req: { user?: { id: string; role: string }; ip?: string; headers?: Record<string, unknown> }) {
  return {
    actor: req.user ? { id: req.user.id, role: req.user.role } : null,
    ip: req.ip ?? (req.headers?.["x-forwarded-for"] as string | undefined) ?? null,
    userAgent: req.headers?.["user-agent"] as string | undefined ?? null,
  };
}
