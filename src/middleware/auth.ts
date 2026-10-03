import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "../utils/security";
import { UnauthorizedError } from "../common/errors";
import { Role } from "@prisma/client";
import { prisma } from "../utils/prisma";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
    email: string;
    name: string | null;
  };
  tokenPayload?: JwtPayload;
}

export function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  const token = authHeader.substring(7).trim();
  return token || undefined;
}

export async function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return next(new UnauthorizedError("Missing Authorization: Bearer <token>"));

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, deletedAt: true },
    });

    if (!user) return next(new UnauthorizedError("User not found"));
    if (user.deletedAt) return next(new UnauthorizedError("Account is disabled"));

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    req.tokenPayload = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    req.user = undefined;
    return next();
  }
  try {
    const payload = verifyAccessToken(token);
    prisma.user
      .findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true, deletedAt: true },
      })
      .then((user) => {
        if (user && !user.deletedAt) {
          req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
        }
        req.tokenPayload = payload;
        next();
      });
  } catch {
    req.user = undefined;
    next();
  }
}
