import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, JwtPayload } from "../../utils/security";
import { sendEmail, renderVerificationEmail } from "../../utils/email";
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from "../../common/errors";
import { writeAuditLog, AuditActor } from "../../common/audit";
import { env } from "../../config";
import { OAuth2Client } from "google-auth-library";
import { parseDurationToSeconds } from "../../utils/security";

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client | null {
  if (!env.google.enabled || !env.google.clientId || !env.google.clientSecret) return null;
  if (!googleClient) googleClient = new OAuth2Client(env.google.clientId, env.google.clientSecret);
  return googleClient;
}

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function issueTokens(user: { id: string; role: Role }): TokenBundle {
  return {
    accessToken: generateAccessToken(user.id, user.role),
    refreshToken: generateRefreshToken(user.id, user.role),
    expiresIn: parseDurationToSeconds(env.jwt.accessExpiresIn),
  };
}

export async function registerTenant(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<TokenBundle> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: Role.TENANT,
    },
  });

  await writeAuditLog({
    action: "USER_CREATED",
    actor: { id: user.id, role: user.role },
    entityId: user.id,
    entityType: "user",
    after: { id: user.id, email: user.email, role: user.role },
  });
  await sendVerificationEmail(user.id, user.email, user.name ?? "");

  return issueTokens(user);
}

export async function registerOwner(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<TokenBundle> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: Role.OWNER,
    },
  });

  await writeAuditLog({
    action: "USER_CREATED",
    actor: { id: user.id, role: user.role },
    entityId: user.id,
    entityType: "user",
    after: { id: user.id, email: user.email, role: user.role },
  });
  await sendVerificationEmail(user.id, user.email, user.name ?? "");

  return issueTokens(user);
}

export async function login(email: string, password: string, actor?: AuditActor): Promise<TokenBundle> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.deletedAt) throw new UnauthorizedError("Invalid email or password");
  if (!user.passwordHash) throw new UnauthorizedError("Invalid email or password");
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  const tokens = issueTokens(user);
  const refreshHash = crypto.createHash("sha256").update(tokens.refreshToken).digest("hex");
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: refreshHash } });

  await writeAuditLog({
    action: "AUTH_LOGIN",
    actor: { id: user.id, role: user.role },
    entityId: user.id,
    entityType: "user",
    ip: actor?.ip,
    userAgent: actor?.userAgent,
  });
  return tokens;
}

export async function refresh(refreshToken: string): Promise<TokenBundle> {
  const payload = verifyRefreshToken(refreshToken) as JwtPayload;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.deletedAt) throw new UnauthorizedError("Invalid refresh token");

  const currentHash = user.refreshTokenHash;
  const providedHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  if (!currentHash || currentHash !== providedHash) throw new UnauthorizedError("Invalid refresh token");

  const tokens = issueTokens(user);
  const newRefreshHash = crypto.createHash("sha256").update(tokens.refreshToken).digest("hex");
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: newRefreshHash } });

  await writeAuditLog({
    action: "AUTH_TOKEN_REFRESHED",
    actor: { id: user.id, role: user.role },
    entityId: user.id,
    entityType: "user",
  });
  return tokens;
}

export async function logout(userId: string, actor?: AuditActor): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
  if (actor) {
    await writeAuditLog({
      action: "AUTH_LOGOUT",
      actor: { id: userId, role: actor.role },
      entityId: userId,
      entityType: "user",
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }
}

export async function googleSignIn(idToken: string, actor?: AuditActor): Promise<TokenBundle> {
  const client = getGoogleClient();
  if (!client) throw new BadRequestError("Google OAuth is not enabled");

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    });
  } catch {
    throw new UnauthorizedError("Invalid Google ID token");
  }
  const payload = ticket.getPayload();
  if (!payload?.email) throw new UnauthorizedError("Google token missing email");

  const existing = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });
  if (existing && existing.deletedAt) throw new UnauthorizedError("Account is disabled");
  if (existing) {
    if (actor) {
      await writeAuditLog({ action: "AUTH_LOGIN", actor: { id: existing.id, role: existing.role }, entityId: existing.id, entityType: "user", ip: actor.ip, userAgent: actor.userAgent });
    }
    return issueTokens(existing);
  }

  const user = await prisma.user.create({
    data: {
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email.split("@")[0],
      image: payload.picture ?? null,
      passwordHash: null,
      isVerified: payload.email_verified ?? false,
      role: Role.TENANT,
    },
  });
  await writeAuditLog({ action: "USER_CREATED", actor: { id: user.id, role: user.role }, entityId: user.id, entityType: "user", after: { id: user.id, email: user.email, role: user.role } });
  return issueTokens(user);
}

export async function sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
  if (!email) return;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.user.update({ where: { id: userId }, data: { verificationToken: tokenHash, verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } });

  const emailOpts = renderVerificationEmail(token, name);
  emailOpts.to = email;
  await sendEmail(emailOpts);
}

export async function verifyEmail(token: string): Promise<void> {
  if (!token) throw new BadRequestError("Token is required");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({ where: { verificationToken: tokenHash, verificationTokenExpires: { gte: new Date() } } });
  if (!user) throw new NotFoundError("Invalid or expired verification token");
  await prisma.user.update({ where: { id: user.id }, data: { isVerified: true, verificationToken: null, verificationTokenExpires: null } });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user && user.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: tokenHash, resetTokenExpires: new Date(Date.now() + 1 * 60 * 60 * 1000) } });
    const resetLink = `${env.webAppUrl}/reset-password?token=${token}`;
    await sendEmail({ to: user.email, subject: "Password reset", html: `<p>Reset your password: <a href="${resetLink}">${resetLink}</a></p>` });
  }
}

export async function resendVerification(email: string): Promise<void> {
  if (!email) throw new BadRequestError("Email is required");
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;
  if (user.isVerified) return;
  await sendVerificationEmail(user.id, user.email, user.name ?? "");
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({ where: { resetToken: tokenHash, resetTokenExpires: { gte: new Date() } } });
  if (!user) throw new NotFoundError("Invalid or expired reset token");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), resetToken: null, resetTokenExpires: null } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw new NotFoundError("User not found");
  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new BadRequestError("Current password is incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
}
