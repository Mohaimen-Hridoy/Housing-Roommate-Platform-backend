import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { makeOwner, makeTenant, authHeader } from "./helpers";

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

describe("Reviews", () => {
  it("tenant of an approved booking can review the reviewed room", async () => {
    const owner = await makeOwner("rev-owner@test.local");
    const tenant = await makeTenant("rev-tenant@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "RevProp", address: "1 St", city: "C", status: "PUBLISHED" });
    const roomRes = await request(app).post(`/api/v1/properties/${propRes.body.data.id}/rooms`).set(authHeader(owner.token)).send({ title: "Room1", rent: 900, currency: "usd", status: "AVAILABLE" });
    const roomId = roomRes.body.data.id;

    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: dateOffset(5), endDate: dateOffset(35) });
    await request(app).patch(`/api/v1/bookings/${bookingRes.body.data.id}/approve`).set(authHeader(owner.token));

    const reviewRes = await request(app)
      .post("/api/v1/reviews")
      .set(authHeader(tenant.token))
      .send({ subject: "ROOM", reviewableId: roomId, bookingId: bookingRes.body.data.id, rating: 5, comment: "Lovely" });
    expect(reviewRes.status).toBe(201);

    const list = await request(app).get(`/api/v1/reviews?subject=ROOM&reviewableId=${roomId}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
  });

  it("rejects duplicate review", async () => {
    const owner = await makeOwner("rev-owner2@test.local");
    const tenant = await makeTenant("rev-tenant2@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "RevProp2", address: "1 St", city: "C", status: "PUBLISHED" });
    const roomRes = await request(app).post(`/api/v1/properties/${propRes.body.data.id}/rooms`).set(authHeader(owner.token)).send({ title: "Room2", rent: 900, currency: "usd", status: "AVAILABLE" });
    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId: roomRes.body.data.id, startDate: dateOffset(5), endDate: dateOffset(35) });
    await request(app).patch(`/api/v1/bookings/${bookingRes.body.data.id}/approve`).set(authHeader(owner.token));

    const first = await request(app).post("/api/v1/reviews").set(authHeader(tenant.token)).send({ subject: "ROOM", reviewableId: roomRes.body.data.id, bookingId: bookingRes.body.data.id, rating: 4 });
    expect(first.status).toBe(201);
    const dup = await request(app).post("/api/v1/reviews").set(authHeader(tenant.token)).send({ subject: "ROOM", reviewableId: roomRes.body.data.id, bookingId: bookingRes.body.data.id, rating: 5 });
    expect(dup.status).toBe(409);
  });

  it("non-participant cannot review", async () => {
    const owner = await makeOwner("rev-owner3@test.local");
    const tenant = await makeTenant("rev-tenant3@test.local");
    const other = await makeTenant("rev-other@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "RevProp3", address: "1 St", city: "C", status: "PUBLISHED" });
    const roomRes = await request(app).post(`/api/v1/properties/${propRes.body.data.id}/rooms`).set(authHeader(owner.token)).send({ title: "Room3", rent: 900, currency: "usd", status: "AVAILABLE" });
    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId: roomRes.body.data.id, startDate: dateOffset(5), endDate: dateOffset(35) });
    await request(app).patch(`/api/v1/bookings/${bookingRes.body.data.id}/approve`).set(authHeader(owner.token));

    const res = await request(app).post("/api/v1/reviews").set(authHeader(other.token)).send({ subject: "ROOM", reviewableId: roomRes.body.data.id, bookingId: bookingRes.body.data.id, rating: 3 });
    expect(res.status).toBe(403);
  });

  it("author can delete own review", async () => {
    const owner = await makeOwner("rev-owner4@test.local");
    const tenant = await makeTenant("rev-tenant4@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "RevProp4", address: "1 St", city: "C", status: "PUBLISHED" });
    const roomRes = await request(app).post(`/api/v1/properties/${propRes.body.data.id}/rooms`).set(authHeader(owner.token)).send({ title: "Room4", rent: 900, currency: "usd", status: "AVAILABLE" });
    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId: roomRes.body.data.id, startDate: dateOffset(5), endDate: dateOffset(35) });
    await request(app).patch(`/api/v1/bookings/${bookingRes.body.data.id}/approve`).set(authHeader(owner.token));
    const reviewRes = await request(app).post("/api/v1/reviews").set(authHeader(tenant.token)).send({ subject: "ROOM", reviewableId: roomRes.body.data.id, bookingId: bookingRes.body.data.id, rating: 5 });
    const reviewId = reviewRes.body.data.id;
    const del = await request(app).delete(`/api/v1/reviews/${reviewId}`).set(authHeader(tenant.token));
    expect(del.status).toBe(200);
    expect(await prisma.review.findUnique({ where: { id: reviewId } })).toBeNull();
  });
});
