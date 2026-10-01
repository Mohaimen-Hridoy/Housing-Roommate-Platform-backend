import { Request, Response, NextFunction } from "express";
import { constructWebhookEvent } from "../../utils/stripe";
import { prisma } from "../../utils/prisma";
import { PaymentStatus, PaymentProvider } from "@prisma/client";
import { logger } from "../../utils/logger";
import { BadRequestError } from "../../common/errors";

export interface StripeWebhookRequest extends Request {
  body: Buffer;
}

export const stripeWebhook = async (req: StripeWebhookRequest, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) throw new BadRequestError("Missing Stripe signature");

    let event;
    try {
      event = constructWebhookEvent(req.body, sig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
      logger.warn(`Stripe webhook signature verification failed: ${msg}`);
      res.status(400).send(`Webhook Error: ${msg}`);
      return;
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as { id: string; metadata?: Record<string, string> };
        const payment = await prisma.payment.findFirst({ where: { providerPaymentId: intent.id } });
        if (payment) {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED } });
          if (intent.metadata?.booking_id) {
            await prisma.booking.update({ where: { id: intent.metadata.booking_id }, data: { reviewedAt: new Date() } });
          }
        }
        logger.info(`Payment succeeded: ${intent.id}`);
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as { id: string; metadata?: Record<string, string> };
        const payment = await prisma.payment.findFirst({ where: { providerPaymentId: intent.id } });
        if (payment) await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
        logger.warn(`Payment failed: ${intent.id}`);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as { payment_intent?: { id?: string }; id: string };
        if (charge.payment_intent?.id) {
          const payment = await prisma.payment.findFirst({ where: { providerPaymentId: charge.payment_intent.id, provider: PaymentProvider.STRIPE } });
          if (payment) await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } });
        }
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};
