import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { makeTenant, makeOwner, makeAdmin, authHeader, PASSWORD } from "./helpers";

describe("Auth", () => {
  it("registers a tenant and returns tokens", async () => {
    const res = await request(app).post("/api/v1/auth/register/tenant").send({ name: "T", email: "tenant1@test.local", password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it("rejects duplicate registration", async () => {
    await request(app).post("/api/v1/auth/register/tenant").send({ name: "T", email: "dupe@test.local", password: PASSWORD });
    const res = await request(app).post("/api/v1/auth/register/tenant").send({ name: "T", email: "dupe@test.local", password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it("rejects weak password", async () => {
    const res = await request(app).post("/api/v1/auth/register/tenant").send({ name: "T", email: "weak@test.local", password: "123" });
    expect(res.status).toBe(422);
  });

  it("logs in with email/password", async () => {
    const user = await makeTenant("login@test.local");
    const res = await request(app).post("/api/v1/auth/login").send({ email: "login@test.local", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    void user;
  });

  it("fails login on wrong password", async () => {
    await makeTenant("wrongpw@test.local");
    const res = await request(app).post("/api/v1/auth/login").send({ email: "wrongpw@test.local", password: "nope1234" });
    expect(res.status).toBe(401);
  });

  it("returns current user via /me with a valid token", async () => {
    const user = await makeTenant("me@test.local");
    const res = await request(app).get("/api/v1/auth/me").set(authHeader(user.token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("me@test.local");
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("refreshes an access token", async () => {
    const user = await makeTenant("refresh@test.local");
    void user;
    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: "refresh@test.local", password: PASSWORD });
    const refreshToken = loginRes.body.data.refreshToken;
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("rejects an invalid refresh token", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "invalid" });
    expect(res.status).toBe(401);
  });

  it("logs out (clears refresh token)", async () => {
    const user = await makeTenant("logout@test.local");
    const res = await request(app).post("/api/v1/auth/logout").set(authHeader(user.token));
    expect(res.status).toBe(200);
    const dbUser = await prisma.user.findUnique({ where: { email: "logout@test.local" }, select: { refreshTokenHash: true } });
    expect(dbUser?.refreshTokenHash).toBeNull();
  });

  it("tenant cannot list users (RBAC)", async () => {
    const user = await makeTenant("rbac@test.local");
    const res = await request(app).get("/api/v1/users").set(authHeader(user.token));
    expect(res.status).toBe(403);
  });

  it("owner cannot list users (RBAC)", async () => {
    const user = await makeOwner("rbac2@test.local");
    const res = await request(app).get("/api/v1/users").set(authHeader(user.token));
    expect(res.status).toBe(403);
  });

  it("admin can list users", async () => {
    const admin = await makeAdmin("admin1@test.local");
    const res = await request(app).get("/api/v1/users").set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("admin can change a user's role", async () => {
    const admin = await makeAdmin("admin2@test.local");
    const tenant = await makeTenant("rolechange@test.local");
    const resp = await request(app).patch(`/api/v1/users/${tenant.id}/role`).set(authHeader(admin.token)).send({ role: "OWNER" });
    expect(resp.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { id: tenant.id }, select: { role: true } });
    expect(updated?.role).toBe("OWNER");
  });
});
