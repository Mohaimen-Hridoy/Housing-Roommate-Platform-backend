import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config";
import { Role } from "@prisma/client";
import { BadRequestError, UnauthorizedError } from "../common/errors";

export interface JwtPayload {
  sub: string;
  role: Role;
  type: "access" | "refresh";
  iat: number;
  exp: number;
  iss: string;
  jti?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.bcryptRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role, type: "access" }, env.jwt.accessSecret, {
    expiresIn: parseDurationToSeconds(env.jwt.accessExpiresIn),
    issuer: env.jwt.issuer,
  });
}

export function generateRefreshToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role, type: "refresh" }, env.jwt.refreshSecret, {
    expiresIn: parseDurationToSeconds(env.jwt.refreshExpiresIn),
    issuer: env.jwt.issuer,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, {
      issuer: env.jwt.issuer,
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (payload.type !== "access") throw new UnauthorizedError("Not an access token");
    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret, {
      issuer: env.jwt.issuer,
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (payload.type !== "refresh") throw new UnauthorizedError("Not a refresh token");
    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}

export function requireRole(...roles: Role[]) {
  return roles.length === 1 ? { hasRole: (r: Role) => r === roles[0] } : { hasRole: (r: Role) => roles.includes(r) };
}

export function assertValidPassword(password: string): void {
  if (password.length < 8) throw new BadRequestError("Password must be at least 8 characters");
}

export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim().toLowerCase());
  if (!match) return 900;
  const n = Number(match[1]);
  const unit = (match[2] ?? "s") as "s" | "m" | "h" | "d";
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return n * mult;
}

