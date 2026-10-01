import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { makeOwner, makeTenant, makeAdmin, authHeader } from "./helpers";
import { PaymentStatus } from "@prisma/client";

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

describe("Payments", () => {
  it("tenant can view payments of own booking; admin can refund (mock mode)", async () => {
    const owner = await makeOwner("pay-owner@test.local");
    const tenant = await makeTenant("pay-tenant@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "P", address: "1 St", city: "C", status: "PUBLISHED" });
    const propertyId = propRes.body.data.id;
    const roomRes = await request(app).post(`/api/v1/properties/${propertyId}/rooms`).set(authHeader(owner.token)).send({ title: "R", rent: 500, currency: "usd", status: "AVAILABLE" });
    const roomId = roomRes.body.data.id;

    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId, startDate: dateOffset(5), endDate: dateOffset(35) });
    await request(app).patch(`/api/v1/bookings/${bookingRes.body.data.id}/approve`).set(authHeader(owner.token));

    const paymentsRes = await request(app).get(`/api/v1/bookings/${bookingRes.body.data.id}/payments`).set(authHeader(tenant.token));
    expect(paymentsRes.status).toBe(200);
    expect(paymentsRes.body.data.length).toBe(1);
    const paymentId = paymentsRes.body.data[0].id;

    const admin = await makeAdmin("pay-admin@test.local");
    const refund = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(authHeader(admin.token));
    expect(refund.status).toBe(200);
    const updated = await prisma.payment.findUnique({ where: { id: paymentId }, select: { status: true } });
    expect(updated?.status).toBe(PaymentStatus.REFUNDED);

    const list = await request(app).get("/api/v1/payments").set(authHeader(admin.token));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
  });

  it("tenant cannot refund a payment", async () => {
    const owner = await makeOwner("pay-owner2@test.local");
    const tenant = await makeTenant("pay-tenant2@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "P2", address: "1 St", city: "C", status: "PUBLISHED" });
    const roomRes = await request(app).post(`/api/v1/properties/${propRes.body.data.id}/rooms`).set(authHeader(owner.token)).send({ title: "R2", rent: 400, currency: "usd", status: "AVAILABLE" });
    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId: roomRes.body.data.id, startDate: dateOffset(5), endDate: dateOffset(35) });
    await request(app).patch(`/api/v1/bookings/${bookingRes.body.data.id}/approve`).set(authHeader(owner.token));
    const paymentsRes = await request(app).get(`/api/v1/bookings/${bookingRes.body.data.id}/payments`).set(authHeader(tenant.token));
    const paymentId = paymentsRes.body.data[0].id;
    const refund = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(authHeader(tenant.token));
    expect(refund.status).toBe(403);
  });
});
