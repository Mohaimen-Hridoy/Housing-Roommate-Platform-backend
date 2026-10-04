import crypto from "node:crypto";
import { Prisma, Role, BookingStatus, PaymentProvider, PaymentStatus, RoomStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { env } from "../../config";
import { createBookingCheckoutSession, isStripeEnabled, getStripe } from "../../utils/stripe";
import { buildMeta, PaginationMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

export interface BookingCreateInput {
  roomId: string;
  startDate: Date;
  endDate: Date;
  message?: string;
}

export interface BookingListItem {
  id: string;
  tenantId: string;
  roomId: string;
  propertyId: string;
  status: BookingStatus;
  startDate: Date;
  endDate: Date | null;
  nightlyRate: number;
  currency: string;
  totalAmount: number;
  platformFee: number;
  payment: { id: string; status: PaymentStatus } | null;
  createdAt: Date;
}

function countNights(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function canViewBooking(booking: { tenantId: string; property: { ownerId: string } }, actor: Actor): boolean {
  if (actor.role === Role.ADMIN) return true;
  if (booking.tenantId === actor.id) return true;
  if (booking.property.ownerId === actor.id) return true;
  return false;
}

export async function createBooking(input: BookingCreateInput, tenant: Actor): Promise<BookingListItem> {
  if (tenant.role !== Role.TENANT && tenant.role !== Role.ADMIN) {
    throw new BadRequestError("Only tenants can create bookings");
  }

  const room = await prisma.room.findFirst({
    where: { id: input.roomId, deletedAt: null },
    include: { property: { select: { id: true, ownerId: true, status: true } } },
  });
  if (!room) throw new NotFoundError("Room not found");
  if (room.property.status !== "PUBLISHED") throw new BadRequestError("Property is not published");

  const overlap = await prisma.booking.findFirst({
    where: {
      roomId: input.roomId,
      status: { in: [BookingStatus.APPROVED] },
      OR: [{ startDate: { lte: input.endDate, gte: input.startDate } }, { endDate: { gte: input.startDate, lte: input.endDate } }],
    },
  });
  if (overlap) throw new ConflictError("Room is already booked for these dates");
  if (room.status !== RoomStatus.AVAILABLE) throw new BadRequestError("Room is not available for booking");

  const nights = countNights(input.startDate, input.endDate);
  const nightlyRate = room.rent;
  const totalAmount = Number((nightlyRate * nights).toFixed(2));
  const platformFee = Number(((totalAmount * env.stripe.platformFeePercent) / 100).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        room: { connect: { id: input.roomId } },
        property: { connect: { id: room.property.id } },
        status: BookingStatus.PENDING,
        startDate: input.startDate,
        endDate: input.endDate,
        nightlyRate,
        currency: room.currency,
        totalAmount,
        platformFee,
        message: input.message,
      },
    });

    await tx.room.update({ where: { id: input.roomId }, data: { status: RoomStatus.RESERVED } });

    const payment = await tx.payment.create({
      data: {
        booking: { connect: { id: booking.id } },
        tenant: { connect: { id: tenant.id } },
        provider: env.stripe.enabled ? PaymentProvider.STRIPE : PaymentProvider.MOCK,
        amount: totalAmount,
        currency: room.currency,
        status: PaymentStatus.PENDING,
      },
    });

    return { booking, payment };
  });

  await writeAuditLog({
    action: "BOOKING_CREATED",
    actor: tenant,
    entityId: result.booking.id,
    entityType: "booking",
    after: { id: result.booking.id, roomId: input.roomId, totalAmount, status: BookingStatus.PENDING },
  }).catch(() => undefined);

  return getBookingById(result.booking.id, tenant);
}

export async function getBookingById(id: string, actor: Actor): Promise<BookingListItem> {
  const booking = await prisma.booking.findFirst({
    where: { id, deletedAt: null },
    include: {
      room: { select: { id: true, title: true, propertyId: true, currency: true, rent: true } },
      property: { select: { id: true, title: true, city: true, ownerId: true } },
      tenant: { select: { id: true, name: true, email: true } },
      payments: { select: { id: true, status: true, provider: true, providerPaymentId: true, clientSecret: true, amount: true, currency: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!booking) throw new NotFoundError("Booking not found");
  if (!canViewBooking(booking, actor)) throw new ForbiddenError("You do not have access to this booking");

  return {
    id: booking.id,
    tenantId: booking.tenantId,
    roomId: booking.roomId,
    propertyId: booking.propertyId,
    status: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
    nightlyRate: booking.nightlyRate,
    currency: booking.currency,
    totalAmount: booking.totalAmount,
    platformFee: booking.platformFee,
    payment: booking.payments.length
      ? { id: booking.payments[0].id, status: booking.payments[0].status }
      : null,
    createdAt: booking.createdAt,
  };
}

export interface ListBookingsInput {
  status?: BookingStatus;
  tenantId?: string;
  propertyId?: string;
  roomId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function listBookings(input: ListBookingsInput, actor: Actor): Promise<{ rows: BookingListItem[]; meta: { pagination: PaginationMeta } }> {
  const allowedSort = ["createdAt", "startDate", "endDate", "totalAmount"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.BookingWhereInput = {
    deletedAt: null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    ...(input.roomId ? { roomId: input.roomId } : {}),
    ...(input.from ? { startDate: { gte: input.from } } : {}),
    ...(input.to ? { endDate: { lte: input.to } } : {}),
  };

  if (actor.role === Role.TENANT) {
    where.tenantId = actor.id;
  } else if (actor.role === Role.OWNER) {
    where.property = { ownerId: actor.id };
  }

  const [totalItems, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take,
      include: {
        room: { select: { id: true, title: true } },
        property: { select: { id: true, title: true, ownerId: true } },
        payments: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const items: BookingListItem[] = rows.map((b) => ({
    id: b.id,
    tenantId: b.tenantId,
    roomId: b.roomId,
    propertyId: b.propertyId,
    status: b.status,
    startDate: b.startDate,
    endDate: b.endDate,
    nightlyRate: b.nightlyRate,
    currency: b.currency,
    totalAmount: b.totalAmount,
    platformFee: b.platformFee,
    payment: b.payments.length ? { id: b.payments[0].id, status: b.payments[0].status } : null,
    createdAt: b.createdAt,
  }));

  return { rows: items, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function approveBooking(id: string, actor: Actor, override?: { endDate?: Date }): Promise<BookingListItem> {
  const booking = await prisma.booking.findFirst({
    where: { id, deletedAt: null },
    include: { room: { select: { id: true, property: { select: { ownerId: true } } } }, property: { select: { ownerId: true } }, payments: { select: { id: true } } },
  });
  if (!booking) throw new NotFoundError("Booking not found");
  if (actor.role !== Role.ADMIN && booking.property.ownerId !== actor.id) throw new ForbiddenError("Only the property owner can approve this booking");
  if (booking.status !== BookingStatus.PENDING) throw new BadRequestError(`Cannot approve a booking in ${booking.status} status`);

  const paymentId = booking.payments[0]?.id;

  const result = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.APPROVED,
        endDate: override?.endDate ?? booking.endDate,
        reviewedAt: new Date(),
      },
    });

    await tx.room.update({ where: { id: booking.roomId }, data: { status: RoomStatus.OCCUPIED } });

    let paymentStatus: PaymentStatus = PaymentStatus.PROCESSING;
    let clientSecret: string | null = null;
    let providerPaymentId: string | null = null;

    if (isStripeEnabled()) {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(updatedBooking.totalAmount * 100),
        currency: updatedBooking.currency,
        metadata: { booking_id: updatedBooking.id, tenant_id: updatedBooking.tenantId, type: "booking_payment" },
      });
      providerPaymentId = intent.id;
      clientSecret = intent.client_secret;
    } else {
      providerPaymentId = `mock_${crypto.randomUUID()}`;
      paymentStatus = PaymentStatus.SUCCEEDED;
    }

    let paymentRecordId: string | undefined;
    if (paymentId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          provider: env.stripe.enabled ? PaymentProvider.STRIPE : PaymentProvider.MOCK,
          status: paymentStatus,
          clientSecret,
          providerPaymentId,
        },
      });
      paymentRecordId = paymentId;
    } else {
      const created = await tx.payment.create({
        data: {
          booking: { connect: { id: booking.id } },
          tenant: { connect: { id: booking.tenantId } },
          provider: env.stripe.enabled ? PaymentProvider.STRIPE : PaymentProvider.MOCK,
          status: paymentStatus,
          clientSecret,
          providerPaymentId,
          amount: updatedBooking.totalAmount,
          currency: updatedBooking.currency,
        },
      });
      paymentRecordId = created.id;
    }

    return { booking: updatedBooking, payment: { id: paymentRecordId, status: paymentStatus } };
  });

  await writeAuditLog({
    action: "BOOKING_STATUS_CHANGED",
    actor,
    entityId: result.booking.id,
    entityType: "booking",
    before: { status: BookingStatus.PENDING },
    after: { status: BookingStatus.APPROVED, paymentId: result.payment.id, paymentStatus: result.payment.status },
  }).catch(() => undefined);

  return getBookingById(result.booking.id, actor);
}

export async function rejectBooking(id: string, actor: Actor, reason?: string): Promise<BookingListItem> {
  const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true, property: { select: { ownerId: true } }, roomId: true } });
  if (!booking) throw new NotFoundError("Booking not found");
  if (actor.role !== Role.ADMIN && booking.property.ownerId !== actor.id) throw new ForbiddenError("Only the property owner can reject this booking");
  if (booking.status !== BookingStatus.PENDING) throw new BadRequestError(`Cannot reject a booking in ${booking.status} status`);

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({ where: { id }, data: { status: BookingStatus.REJECTED } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: RoomStatus.AVAILABLE } });
    return b;
  });
  await writeAuditLog({ action: "BOOKING_STATUS_CHANGED", actor, entityId: id, entityType: "booking", before: { status: BookingStatus.PENDING }, after: { status: BookingStatus.REJECTED, reason } }).catch(() => undefined);
  return getBookingById(updated.id, actor);
}

export async function cancelBooking(id: string, actor: Actor, reason?: string): Promise<BookingListItem> {
  const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true, roomId: true, tenantId: true, property: { select: { ownerId: true } }, payments: { select: { id: true, status: true } } } });
  if (!booking) throw new NotFoundError("Booking not found");
  const isTenant = booking.tenantId === actor.id;
  const isOwner = booking.property.ownerId === actor.id || actor.role === Role.ADMIN;
  if (!isTenant && !isOwner) throw new ForbiddenError("You cannot cancel this booking");

  if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.APPROVED) {
    // ok
  } else {
    throw new BadRequestError(`Cannot cancel a booking in ${booking.status} status`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED } });
    await tx.room.update({ where: { id: booking.roomId }, data: { status: RoomStatus.AVAILABLE } });
    // Refund payment if applicable.
    if (booking.payments.length && booking.payments[0].status === PaymentStatus.SUCCEEDED) {
      await tx.payment.update({ where: { id: booking.payments[0].id }, data: { status: PaymentStatus.REFUNDED } });
    }
    return b;
  });
  await writeAuditLog({ action: "BOOKING_CANCELLED", actor, entityId: id, entityType: "booking", after: { status: BookingStatus.CANCELLED, reason } }).catch(() => undefined);
  return getBookingById(updated.id, actor);
}

export async function deleteBooking(id: string, actor: Actor): Promise<{ id: string; deleted: true }> {
  const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null }, select: { status: true, property: { select: { ownerId: true } }, tenantId: true } });
  if (!booking) throw new NotFoundError("Booking not found");
  const isOwner = booking.property.ownerId === actor.id || actor.role === Role.ADMIN;
  if (!isOwner) throw new ForbiddenError("You cannot delete this booking");
  if (booking.status === BookingStatus.APPROVED) throw new BadRequestError("Cannot delete an approved booking; cancel it instead");

  await prisma.booking.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({ action: "BOOKING_STATUS_CHANGED", actor, entityId: id, entityType: "booking", after: { deleted: true } }).catch(() => undefined);
  return { id, deleted: true };
}

export async function getBookingPayments(id: string, actor: Actor) {
  const booking = await prisma.booking.findFirst({ where: { id, deletedAt: null }, select: { tenantId: true, property: { select: { ownerId: true } } } });
  if (!booking) throw new NotFoundError("Booking not found");
  if (!canViewBooking(booking, actor)) throw new ForbiddenError("You do not have access to this booking");
  return prisma.payment.findMany({ where: { bookingId: id }, orderBy: { createdAt: "desc" } });
}

export async function createBookingCheckout(id: string, actor: Actor) {
  const booking = await prisma.booking.findFirst({
    where: { id, deletedAt: null },
    include: { room: { select: { currency: true } }, property: { select: { ownerId: true } } },
  });
  if (!booking) throw new NotFoundError("Booking not found");
  if (booking.tenantId !== actor.id && actor.role !== Role.ADMIN) throw new ForbiddenError("Not allowed");
  if (booking.status !== BookingStatus.APPROVED) throw new BadRequestError("Booking must be approved before payment");

  const payment = await prisma.payment.findFirst({ where: { bookingId: id }, orderBy: { createdAt: "desc" } });
  if (!payment) throw new NotFoundError("No payment record for this booking");

  if (!env.stripe.enabled || !isStripeEnabled()) {
    return { provider: PaymentProvider.MOCK, status: payment.status, clientSecret: null, amount: payment.amount, currency: payment.currency };
  }

  const session = await createBookingCheckoutSession({
    amount: payment.amount,
    currency: payment.currency,
    bookingId: booking.id,
    tenantId: booking.tenantId,
    successUrl: `${env.webAppUrl}/bookings/${booking.id}/success`,
    cancelUrl: `${env.webAppUrl}/bookings/${booking.id}`,
  });
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.PROCESSING,
      providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    },
  });
  return { provider: PaymentProvider.STRIPE, status: payment.status, clientSecret: null, checkoutUrl: session.url, amount: payment.amount, currency: payment.currency };
}
