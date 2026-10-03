import Stripe from "stripe";
import { env } from "../config";
import { BadRequestError } from "../common/errors";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.stripe.enabled) throw new BadRequestError("Stripe integration is not enabled");
  if (!env.stripe.secretKey) throw new BadRequestError("Stripe secret key is not configured");
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripe.secretKey, {
       apiVersion: "2023-08-16",
      typescript: true,
    });
  }
  return stripeClient;
}

export function isStripeEnabled(): boolean {
  return env.stripe.enabled && !!env.stripe.secretKey;
}

export interface CheckoutParams {
  amount: number;
  currency: string;
  bookingId: string;
  tenantId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createBookingCheckoutSession(params: CheckoutParams): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const feeAmount = Math.round((params.amount * env.stripe.platformFeePercent) / 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    currency: params.currency,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: {
            name: `Booking #${params.bookingId} deposit`,
            description: `Housing platform booking payment for booking ${params.bookingId}`,
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      // NOTE: application_fee_amount is deliberately omitted. Stripe only
      // accepts it on a destination charge (transfer_data[destination]) or a
      // direct charge made with the platform's own OAuth key, so passing it
      // against a single standard account fails with parameter_missing and
      // breaks every checkout session. The fee is still recorded on
      // Booking.platformFee for reporting; actually routing it to a connected
      // landlord account would need Stripe Connect.
      metadata: {
        booking_id: params.bookingId,
        tenant_id: params.tenantId,
        platform: "housing-backend",
        platform_fee_percent: String(env.stripe.platformFeePercent),
        platform_fee_amount: String(feeAmount),
      },
    },
    metadata: {
      booking_id: params.bookingId,
      tenant_id: params.tenantId,
      type: "booking_payment",
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
  return session;
}

export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  const stripe = getStripe();
  if (!env.stripe.webhookSecret) throw new BadRequestError("Stripe webhook secret is not configured");
  return stripe.webhooks.constructEvent(payload, signature, env.stripe.webhookSecret);
}

