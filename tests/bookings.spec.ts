import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { makeOwner, makeTenant, authHeader, AuthedUser } from "./helpers";
import { RoomStatus, BookingStatus, PaymentStatus } from "@prisma/client";

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

describe("Bookings", () => {
  let owner: AuthedUser;
  let tenant: AuthedUser;
  let propertyId: string;
  let roomId: string;

  beforeEach(async () => {
    owner = (await makeOwner("bk-owner@test.local")) as AuthedUser;
    tenant = (await makeTenant("bk-tenant@test.local")) as AuthedUser;

    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({
      title: "Booking Property",
      address: "1 St",
      city: "C",
      status: "PUBLISHED",
    });
    propertyId = propRes.body.data.id;

    const roomRes = await request(app)
      .post(`/api/v1/properties/${propertyId}/rooms`)
      .set(authHeader(owner.token))
      .send({ title: "Booking Room", rent: 800, currency: "usd", bedrooms: 1, bathrooms: 1, status: "AVAILABLE" });
    roomId = roomRes.body.data.id;
  });

  it("tenant creates a booking (transaction reserves room + creates payment)", async () => {
    const start = dateOffset(10);
    const end = dateOffset(40);
    const res = await request(app)
      .post("/api/v1/bookings")
      .set(authHeader(tenant.token))
      .send({ roomId, startDate: start, endDate: end });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { status: true } });
    expect(room?.status).toBe(RoomStatus.RESERVED);
    const payment = await prisma.payment.findFirst({ where: { bookingId: res.body.data.id }, select: { status: true, amount: true } });
    expect(payment?.status).toBe(PaymentStatus.PENDING);
    expect(payment?.amount).toBe(800 * 30);
  });

  it("prevents overlapping bookings", async () => {
    const start = dateOffset(10);
    const end = dateOffset(70);
    const b1 = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    expect(b1.status).toBe(201);
    await request(app).patch(`/api/v1/bookings/${b1.body.data.id}/approve`).set(authHeader(owner.token));
    const conflict = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    expect(conflict.status).toBe(409);
  });

  it("tenant cannot approve a booking", async () => {
    const start = dateOffset(10);
    const end = dateOffset(40);
    const created = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    const res = await request(app).patch(`/api/v1/bookings/${created.body.data.id}/approve`).set(authHeader(tenant.token));
    expect(res.status).toBe(403);
  });

  it("owner approves -> room OCCUPIED + payment SUCCEEDED (mock)", async () => {
    const start = dateOffset(10);
    const end = dateOffset(40);
    const created = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    const res = await request(app).patch(`/api/v1/bookings/${created.body.data.id}/approve`).set(authHeader(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { status: true } });
    expect(room?.status).toBe(RoomStatus.OCCUPIED);
    const payment = await prisma.payment.findFirst({ where: { bookingId: created.body.data.id }, select: { status: true } });
    expect(payment?.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it("owner rejects -> room back to AVAILABLE", async () => {
    const start = dateOffset(10);
    const end = dateOffset(40);
    const created = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    await request(app).patch(`/api/v1/bookings/${created.body.data.id}/reject`).set(authHeader(owner.token));
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { status: true } });
    expect(room?.status).toBe(RoomStatus.AVAILABLE);
    const booking = await prisma.booking.findUnique({ where: { id: created.body.data.id }, select: { status: true } });
    expect(booking?.status).toBe(BookingStatus.REJECTED);
  });

  it("tenant cancels a booking -> room AVAILABLE", async () => {
    const start = dateOffset(10);
    const end = dateOffset(40);
    const created = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    const res = await request(app).patch(`/api/v1/bookings/${created.body.data.id}/cancel`).set(authHeader(tenant.token)).send({ reason: "changed mind" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CANCELLED");
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { status: true } });
    expect(room?.status).toBe(RoomStatus.AVAILABLE);
  });

  it("scoped listing: tenant sees own bookings", async () => {
    const start = dateOffset(10);
    const end = dateOffset(40);
    await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: start, endDate: end });
    const res = await request(app).get("/api/v1/bookings").set(authHeader(tenant.token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
