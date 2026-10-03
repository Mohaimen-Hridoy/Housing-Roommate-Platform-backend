import request from "supertest";
import { app } from "../src/app";
import { makeOwner, makeTenant, makeAdmin, authHeader, createPublishedPropertyWithRoom } from "./helpers";

describe("Admin statistics", () => {
  it("admin can read platform statistics", async () => {
    const admin = await makeAdmin();
    const res = await request(app).get("/api/v1/admin/stats").set(authHeader(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("users");
    expect(res.body.data).toHaveProperty("bookings");
    expect(res.body.data).toHaveProperty("payments");
    expect(typeof res.body.data.users.total).toBe("number");
  });

  it("tenant is denied platform statistics (RBAC)", async () => {
    const tenant = await makeTenant("stats-tenant@test.local");
    const res = await request(app).get("/api/v1/admin/stats").set(authHeader(tenant.token));
    expect(res.status).toBe(403);
  });

  it("owner is denied platform statistics (RBAC)", async () => {
    const owner = await makeOwner("stats-owner@test.local");
    const res = await request(app).get("/api/v1/admin/stats").set(authHeader(owner.token));
    expect(res.status).toBe(403);
  });

  it("unauthenticated request is rejected", async () => {
    const res = await request(app).get("/api/v1/admin/stats");
    expect(res.status).toBe(401);
  });

  it("statistics reflect seeded listings and bookings", async () => {
    const admin = await makeAdmin();
    const owner = await makeOwner("stats-owner2@test.local");
    await createPublishedPropertyWithRoom(owner);

    const res = await request(app).get("/api/v1/admin/stats?days=7").set(authHeader(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.properties.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.rooms.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.window.days).toBe(7);
  });

  it("rejects an out-of-range window", async () => {
    const admin = await makeAdmin();
    const res = await request(app).get("/api/v1/admin/stats?days=9999").set(authHeader(admin.token));
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("owner dashboard summarises only that owner's listings", async () => {
    const owner = await makeOwner("stats-owner3@test.local");
    const other = await makeOwner("stats-owner4@test.local");
    await createPublishedPropertyWithRoom(owner);
    await createPublishedPropertyWithRoom(other);

    const res = await request(app).get("/api/v1/dashboard").set(authHeader(owner.token));

    expect(res.status).toBe(200);
    expect(res.body.data.listings.properties).toBe(1);
    expect(res.body.data.listings.rooms).toBe(1);
    expect(res.body.data.bookings.pending).toBe(0);
  });

  it("tenant can reach the dashboard endpoint but has no listings", async () => {
    const tenant = await makeTenant("stats-tenant2@test.local");
    const res = await request(app).get("/api/v1/dashboard").set(authHeader(tenant.token));

    expect(res.status).toBe(200);
    expect(res.body.data.listings.properties).toBe(0);
  });
});