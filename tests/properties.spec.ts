import request from "supertest";
import { app } from "../src/app";
import { makeOwner, makeTenant, makeAdmin, authHeader } from "./helpers";

describe("Properties", () => {
  it("owner can create a published property", async () => {
    const owner = await makeOwner("prop-owner1@test.local");
    const res = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({
      title: "Cozy Cottage",
      address: "1 Lake Rd",
      city: "Laketown",
      state: "CA",
      country: "US",
      status: "PUBLISHED",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Cozy Cottage");
  });

  it("unauthenticated user cannot create a property", async () => {
    const res = await request(app).post("/api/v1/properties").send({ title: "X", address: "1 St", city: "C" });
    expect(res.status).toBe(401);
  });

  it("tenant cannot create a property (RBAC)", async () => {
    const tenant = await makeTenant("prop-tenant1@test.local");
    const res = await request(app).post("/api/v1/properties").set(authHeader(tenant.token)).send({ title: "X", address: "1 St", city: "C" });
    expect(res.status).toBe(403);
  });

  it("owner can update own property; non-owner cannot", async () => {
    const owner = await makeOwner("prop-owner2@test.local");
    const tenant = await makeTenant("prop-tenant2@test.local");
    const created = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "House A", address: "1 St", city: "C", status: "PUBLISHED" });
    const propertyId = created.body.data.id;
    const ok = await request(app).patch(`/api/v1/properties/${propertyId}`).set(authHeader(owner.token)).send({ title: "House A Updated" });
    expect(ok.status).toBe(200);
    const forbidden = await request(app).patch(`/api/v1/properties/${propertyId}`).set(authHeader(tenant.token)).send({ title: "Hacked" });
    expect(forbidden.status).toBe(403);
  });

  it("filters and searches properties", async () => {
    const owner = await makeOwner("prop-owner3@test.local");
    await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "Ocean View Villa", address: "1 St", city: "BeachTown", status: "PUBLISHED" });
    const res = await request(app).get("/api/v1/properties?status=PUBLISHED&search=Ocean&city=BeachTown&page=1&pageSize=10&sortBy=title&sortOrder=desc");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta.pagination.totalItems).toBeGreaterThanOrEqual(1);
  });

  it("soft-deletes a property (GET returns 404)", async () => {
    const owner = await makeOwner("prop-owner4@test.local");
    const created = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "Delete Me", address: "1 St", city: "C", status: "DRAFT" });
    const propertyId = created.body.data.id;
    const del = await request(app).delete(`/api/v1/properties/${propertyId}`).set(authHeader(owner.token));
    expect(del.status).toBe(200);
    const got = await request(app).get(`/api/v1/properties/${propertyId}`);
    expect(got.status).toBe(404);
  });

  it("admin can manage amenities and attach to property", async () => {
    const admin = await makeAdmin("adm-ams@test.local");
    const owner = await makeOwner("adm-prop@test.local");
    const am = await request(app).post("/api/v1/amenities").set(authHeader(admin.token)).send({ name: "Pool", icon: "pool" });
    expect(am.status).toBe(201);
    const created = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "Pool House", address: "1 St", city: "C" });
    const propertyId = created.body.data.id;
    const attach = await request(app).post(`/api/v1/properties/${propertyId}/amenities`).set(authHeader(owner.token)).send({ amenityId: am.body.data.id });
    expect(attach.status).toBe(200);
    const fetched = await request(app).get(`/api/v1/properties/${propertyId}`);
    expect(fetched.body.data.amenities.length).toBe(1);
  });
});
