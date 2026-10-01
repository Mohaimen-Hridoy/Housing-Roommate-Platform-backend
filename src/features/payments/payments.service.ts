import { Prisma, Role, PaymentStatus, PaymentProvider } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { buildMeta } from "../../utils/pagination";
import { env } from "../../config";
import { isStripeEnabled, getStripe } from "../../utils/stripe";

type Actor = { id: string; role: Role };

const paymentSelect = {
  id: true,
  bookingId: true,
  tenantId: true,
  provider: true,
  providerPaymentId: true,
  amount: true,
  currency: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export interface ListPaymentsInput {
  status?: PaymentStatus;
  provider?: PaymentProvider;
  bookingId?: string;
  tenantId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function listPayments(input: ListPaymentsInput, actor: Actor) {
  if (actor.role !== Role.ADMIN) throw new ForbiddenError("Admin access required");
  const allowedSort = ["createdAt", "amount"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.PaymentWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.from ? { createdAt: { gte: input.from } } : {}),
    ...(input.to ? { AND: [{ createdAt: { lte: input.to } }] } : {}),
  };
  if (input.from && input.to) where.createdAt = { gte: input.from, lte: input.to };

  const [totalItems, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: paymentSelect }),
  ]);
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function getPayment(id: string, actor: Actor) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { ...paymentSelect, booking: { select: { property: { select: { ownerId: true } } } } },
  });
  if (!payment) throw new NotFoundError("Payment not found");
  const isOwner = payment.booking?.property?.ownerId === actor.id;
  const isTenant = payment.tenantId === actor.id;
  if (actor.role !== Role.ADMIN && !isOwner && !isTenant) throw new ForbiddenError("You do not have access to this payment");
  return payment;
}

export async function refundPayment(id: string, input: { amount?: number }, actor: Actor) {
  if (actor.role !== Role.ADMIN) throw new ForbiddenError("Admin access required");
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { booking: { select: { property: { select: { ownerId: true } } } } },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  if (payment.status !== PaymentStatus.SUCCEEDED) throw new BadRequestError("Only succeeded payments can be refunded");
  if (input.amount !== undefined && input.amount > payment.amount) {
    throw new BadRequestError("Refund amount cannot exceed the payment amount");
  }

  if (env.stripe.enabled && isStripeEnabled() && payment.provider === PaymentProvider.STRIPE) {
    const stripe = getStripe();
    if (!payment.providerPaymentId) throw new BadRequestError("Payment has no provider reference");
    await stripe.refunds.create({
      payment_intent: payment.providerPaymentId,
      ...(input.amount !== undefined ? { amount: Math.round(input.amount * 100) } : {}),
    });
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: input.amount !== undefined && input.amount < payment.amount ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED,
        providerPaymentId: payment.providerPaymentId,
      },
      select: paymentSelect,
    });
    await writeAuditLog({ action: "PAYMENT_STATUS_CHANGED", actor, entityId: payment.id, entityType: "payment", before: { status: PaymentStatus.SUCCEEDED }, after: { status: updated.status, amount: input.amount ?? payment.amount } });
    return updated;
  }

  const status: PaymentStatus = input.amount && input.amount < payment.amount ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED;
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status },
    select: paymentSelect,
  });
  await writeAuditLog({ action: "PAYMENT_STATUS_CHANGED", actor, entityId: payment.id, entityType: "payment", before: { status: PaymentStatus.SUCCEEDED }, after: { status, amount: input.amount ?? payment.amount } });
  return updated;
}
