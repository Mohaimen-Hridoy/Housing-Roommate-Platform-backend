import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { hashPassword, generateAccessToken } from "../src/utils/security";
import { Role } from "@prisma/client";

export const PASSWORD = "Pass1234!";

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
  token: string;
  accessToken: string;
}

export async function makeTenant(email: string): Promise<AuthedUser> {
  const res = await request(app)
    .post("/api/v1/auth/register/tenant")
    .send({ name: "Test Tenant", email, password: PASSWORD });
  const data = res.body.data;
  const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return { id: dbUser ? dbUser.id : "", email, role: Role.TENANT, token: data.accessToken, accessToken: data.accessToken } as AuthedUser;
}

export async function makeOwner(email: string): Promise<AuthedUser> {
  const res = await request(app)
    .post("/api/v1/auth/register/owner")
    .send({ name: "Test Owner", email, password: PASSWORD });
  const data = res.body.data;
  const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return { id: dbUser ? dbUser.id : "", email, role: Role.OWNER, token: data.accessToken, accessToken: data.accessToken } as AuthedUser;
}

export async function makeAdmin(email = "admin@test.local"): Promise<AuthedUser> {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(PASSWORD);
  const user = existing
    ? await prisma.user.update({ where: { email }, data: { passwordHash, isVerified: true, role: Role.ADMIN } })
    : await prisma.user.create({ data: { email, name: "Admin", role: Role.ADMIN, passwordHash, isVerified: true } });
  const token = generateAccessToken(user.id, user.role);
  return { id: user.id, email: user.email, role: user.role, token, accessToken: token };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createPublishedProperty(owner: AuthedUser, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/v1/properties")
    .set(authHeader(owner.token))
    .send({
      title: "Test Property",
      address: "123 Test St",
      city: "TestCity",
      state: "TS",
      country: "US",
      status: "PUBLISHED",
      ...overrides,
    });
  return res.body.data;
}

export async function createPublishedPropertyWithRoom(owner: AuthedUser, overrides: Record<string, unknown> = {}) {
  const property = await createPublishedProperty(owner, overrides);
  const roomRes = await request(app)
    .post(`/api/v1/properties/${property.id}/rooms`)
    .set(authHeader(owner.token))
    .send({ title: "Test Room", rent: 1000, currency: "usd", bedrooms: 1, bathrooms: 1, area: 20, status: "AVAILABLE" });
  return { propertyId: property.id, roomId: roomRes.body.data.id, property };
}
