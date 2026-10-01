import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/utils/prisma";
import { makeOwner, makeTenant, authHeader } from "./helpers";
import { PaymentStatus, PaymentProvider } from "@prisma/client";

// Mock the Stripe verification so the webhook can be exercised without a real signature.
jest.mock("../src/utils/stripe", () => {
  const actual = jest.requireActual("../src/utils/stripe");
  return {
    ...actual,
    constructWebhookEvent: jest.fn(),
    isStripeEnabled: () => true,
  };
});

import { constructWebhookEvent } from "../src/utils/stripe";

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

describe("Stripe webhook", () => {
  it("updates payment status on payment_intent.succeeded", async () => {
    const stripeMock = jest.mocked(constructWebhookEvent);
    const owner = await makeOwner("wh-owner@test.local");
    const tenant = await makeTenant("wh-tenant@test.local");
    const propRes = await request(app).post("/api/v1/properties").set(authHeader(owner.token)).send({ title: "WhProp", address: "1 St", city: "C", status: "PUBLISHED" });
    const roomRes = await request(app).post(`/api/v1/properties/${propRes.body.data.id}/rooms`).set(authHeader(owner.token)).send({ title: "WhRoom", rent: 1000, currency: "usd", status: "AVAILABLE" });
    const bookingRes = await request(app).post("/api/v1/bookings").set(authHeader(tenant.token)).send({ roomId: roomRes.body.data.id, startDate: dateOffset(5), endDate: dateOffset(35) });
    const bookingId = bookingRes.body.data.id;

    // Place a payment record in PROCESSING state with a provider id.
    const payment = await prisma.payment.create({
      data: {
        booking: { connect: { id: bookingId } },
        tenant: { connect: { id: tenant.id } },
        provider: PaymentProvider.STRIPE,
        providerPaymentId: "pi_test_1",
        amount: 30000,
        currency: "usd",
        status: PaymentStatus.PROCESSING,
      },
    });

    stripeMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_test_1", metadata: { booking_id: bookingId, tenant_id: tenant.id } } },
    } as unknown as ReturnType<typeof constructWebhookEvent>);

    const body = Buffer.from(JSON.stringify({ received: true }));
    const res = await request(app)
      .post("/api/v1/stripe/webhook")
      .set("stripe-signature", "test_sig")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(200);

    const updated = await prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
    expect(updated?.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it("returns 400 on invalid signature", async () => {
    const stripeMock = jest.mocked(constructWebhookEvent);
    stripeMock.mockImplementation(() => {
      throw new Error("No signatures found with that signature");
    });
    const body = Buffer.from(JSON.stringify({ id: "evt_test" }));
    const res = await request(app).post("/api/v1/stripe/webhook").set("stripe-signature", "bad").set("Content-Type", "application/json").send(body);
    expect(res.status).toBe(400);
  });
});
