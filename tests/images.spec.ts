import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { makeOwner, makeTenant, makeAdmin, authHeader, createPublishedPropertyWithRoom } from "./helpers";

/** 1x1 transparent PNG - smallest valid image accepted by the mimetype filter. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const attach = (req: request.Test) => req.attach("images", PNG, { filename: "photo.png", contentType: "image/png" });

describe("Images", () => {
  it("owner uploads a property image and the first becomes primary", async () => {
    const owner = await makeOwner("img-owner1@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    const res = await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(owner.token));

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isPrimary).toBe(true);
    expect(res.body.data[0].url).toMatch(/\.png$/);

    const stored = await prisma.propertyImage.count({ where: { propertyId: property.id } });
    expect(stored).toBe(1);
  });

  it("rejects a non-image upload with a structured 422", async () => {
    const owner = await makeOwner("img-owner2@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    const res = await request(app)
      .post(`/api/v1/properties/${property.id}/images`)
      .set(authHeader(owner.token))
      .attach("images", Buffer.from("not-an-image"), { filename: "evil.exe", contentType: "application/x-msdownload" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it("tenant cannot upload images (RBAC)", async () => {
    const owner = await makeOwner("img-owner3@test.local");
    const tenant = await makeTenant("img-tenant3@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    const res = await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(tenant.token));
    expect(res.status).toBe(403);
  });

  it("a different owner cannot upload to someone else's property", async () => {
    const owner = await makeOwner("img-owner4@test.local");
    const intruder = await makeOwner("img-owner4b@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    const res = await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(intruder.token));
    expect(res.status).toBe(403);
  });

  it("uploads images to a room and lists them publicly", async () => {
    const owner = await makeOwner("img-owner5@test.local");
    const { roomId } = await createPublishedPropertyWithRoom(owner);

    const upload = await attach(request(app).post(`/api/v1/rooms/${roomId}/images`)).set(authHeader(owner.token));
    expect(upload.status).toBe(201);

    const list = await request(app).get(`/api/v1/rooms/${roomId}/images`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("only one image stays primary after promoting another", async () => {
    const owner = await makeOwner("img-owner6@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    const first = await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(owner.token));
    await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(owner.token));

    const secondId = (await prisma.propertyImage.findMany({ where: { propertyId: property.id }, orderBy: { position: "asc" } }))[1].id;

    const promote = await request(app).patch(`/api/v1/images/${secondId}/primary`).set(authHeader(owner.token));
    expect(promote.status).toBe(200);
    expect(promote.body.data.isPrimary).toBe(true);

    const primaries = await prisma.propertyImage.count({ where: { propertyId: property.id, isPrimary: true } });
    expect(primaries).toBe(1);
    expect(first.body.data[0].id).not.toBe(secondId);
  });

  it("deleting the primary image promotes the next one", async () => {
    const owner = await makeOwner("img-owner7@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(owner.token));
    await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(owner.token));

    const primary = await prisma.propertyImage.findFirst({ where: { propertyId: property.id, isPrimary: true } });

    const res = await request(app).delete(`/api/v1/images/${primary!.id}`).set(authHeader(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const remaining = await prisma.propertyImage.findMany({ where: { propertyId: property.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].isPrimary).toBe(true);
  });

  it("returns 404 when uploading against an unknown property", async () => {
    const owner = await makeOwner("img-owner8@test.local");
    const res = await attach(request(app).post("/api/v1/properties/does-not-exist/images")).set(authHeader(owner.token));
    expect(res.status).toBe(404);
  });

  it("property detail embeds its images", async () => {
    const owner = await makeOwner("img-owner9@test.local");
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);
    await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(owner.token));

    const res = await request(app).get(`/api/v1/properties/${property.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.images).toHaveLength(1);
  });

  it("admin may upload images to any property", async () => {
    const owner = await makeOwner("img-owner10@test.local");
    const admin = await makeAdmin();
    const property = await createPublishedPropertyWithRoom(owner).then((r) => r.property);

    const res = await attach(request(app).post(`/api/v1/properties/${property.id}/images`)).set(authHeader(admin.token));
    expect(res.status).toBe(201);
  });
});