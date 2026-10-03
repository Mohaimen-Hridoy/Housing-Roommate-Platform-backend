import { BookingStatus, PaymentStatus, PropertyStatus, Role, RoomStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";

const softActive = { deletedAt: null };

type Bucket = Record<string, number>;

const toBuckets = <T extends string>(rows: { [key: string]: unknown }[], key: T): Bucket =>
  rows.reduce<Bucket>((acc, row) => {
    acc[String(row[key] ?? "UNKNOWN")] = Number(row._count ?? 0);
    return acc;
  }, {});

export interface AdminStatsQuery {
  days?: number;
}

export async function getPlatformStats(query: AdminStatsQuery = {}) {
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    usersByRole,
    newUsers,
    verifiedUsers,
    totalProperties,
    propertiesByStatus,
    totalRooms,
    roomsByStatus,
    totalBookings,
    bookingsByStatus,
    newBookings,
    totalPayments,
    paymentsByStatus,
    revenueAgg,
    windowRevenueAgg,
    feeAgg,
    totalReviews,
    ratingAgg,
    favoritesCount,
    messagesCount,
    auditLogsCount,
    topProperties,
    topCities,
  ] = await Promise.all([
    prisma.user.count({ where: softActive }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true }, where: softActive }),
    prisma.user.count({ where: { ...softActive, createdAt: { gte: since } } }),
    prisma.user.count({ where: { ...softActive, isVerified: true } }),
    prisma.property.count({ where: softActive }),
    prisma.property.groupBy({ by: ["status"], _count: { _all: true }, where: softActive }),
    prisma.room.count({ where: softActive }),
    prisma.room.groupBy({ by: ["status"], _count: { _all: true }, where: softActive }),
    prisma.booking.count({ where: softActive }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true }, where: softActive }),
    prisma.booking.count({ where: { ...softActive, createdAt: { gte: since } } }),
    prisma.payment.count(),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] } },
    }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: since } } }),
    prisma.booking.aggregate({
      _sum: { platformFee: true },
      where: { status: BookingStatus.APPROVED, ...softActive },
    }),
    prisma.review.count(),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.favorite.count(),
    prisma.message.count(),
    prisma.auditLog.count(),
    prisma.property.findMany({
      where: { ...softActive, status: PropertyStatus.PUBLISHED },
      select: { id: true, title: true, city: true, _count: { select: { favorites: true, bookings: true } } },
      orderBy: { bookings: { _count: "desc" } },
      take: 5,
    }),
    prisma.property.groupBy({
      by: ["city"],
      _count: { _all: true },
      where: { ...softActive, status: PropertyStatus.PUBLISHED },
      orderBy: { _count: { city: "desc" } },
      take: 5,
    }),
  ]);

  const approvedBookings = bookingsByStatus.find((b) => b.status === BookingStatus.APPROVED)?._count._all ?? 0;
  const occupiedRooms = roomsByStatus.find((r) => r.status === RoomStatus.OCCUPIED)?._count._all ?? 0;

  return {
    window: { days, since: since.toISOString() },
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      newInWindow: newUsers,
      byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])),
    },
    properties: {
      total: totalProperties,
      published: propertiesByStatus.find((p) => p.status === PropertyStatus.PUBLISHED)?._count._all ?? 0,
      byStatus: toBuckets(propertiesByStatus as never[], "status"),
    },
    rooms: {
      total: totalRooms,
      byStatus: toBuckets(roomsByStatus as never[], "status"),
      occupancyRate: totalRooms ? Number((occupiedRooms / totalRooms).toFixed(4)) : 0,
    },
    bookings: {
      total: totalBookings,
      approved: approvedBookings,
      newInWindow: newBookings,
      byStatus: toBuckets(bookingsByStatus as never[], "status"),
      approvalRate: totalBookings ? Number((approvedBookings / totalBookings).toFixed(4)) : 0,
    },
    payments: {
      total: totalPayments,
      byStatus: toBuckets(paymentsByStatus as never[], "status"),
      grossRevenue: revenueAgg._sum.amount ?? 0,
      platformFeeEarned: feeAgg._sum.platformFee ?? 0,
      revenueInWindow: windowRevenueAgg._sum.amount ?? 0,
    },
    engagement: {
      reviews: totalReviews,
      averageRating: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(2)) : 0,
      favorites: favoritesCount,
      messages: messagesCount,
    },
    activity: { auditLogs: auditLogsCount },
    topProperties: topProperties.map((p) => ({
      id: p.id,
      title: p.title,
      city: p.city,
      bookings: p._count.bookings,
      favorites: p._count.favorites,
    })),
    topCities: topCities.map((c) => ({ city: c.city, properties: c._count._all })),
  };
}

export async function getOwnerDashboard(ownerId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ownedProperty = { ownerId, ...softActive };

  const [
    propertyCount,
    roomCount,
    roomsByStatus,
    pendingBookings,
    bookingsInWindow,
    bookingsByStatus,
    revenueAgg,
    feeAgg,
    recentBookings,
    topRooms,
  ] = await Promise.all([
    prisma.property.count({ where: ownedProperty }),
    prisma.room.count({ where: { property: ownedProperty, ...softActive } }),
    prisma.room.groupBy({ by: ["status"], _count: { _all: true }, where: { property: ownedProperty, ...softActive } }),
    prisma.booking.count({ where: { property: ownedProperty, status: BookingStatus.PENDING, ...softActive } }),
    prisma.booking.count({ where: { property: ownedProperty, createdAt: { gte: since }, ...softActive } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true }, where: { property: ownedProperty, ...softActive } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: PaymentStatus.SUCCEEDED, booking: { property: ownedProperty, ...softActive } },
    }),
    prisma.booking.aggregate({ _sum: { platformFee: true }, where: { property: ownedProperty, ...softActive } }),
    prisma.booking.findMany({
      where: { property: ownedProperty, ...softActive },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        room: { select: { title: true } },
        tenant: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.room.findMany({
      where: { property: ownedProperty, ...softActive },
      select: { id: true, title: true, rent: true, currency: true, status: true, _count: { select: { bookings: true } } },
      orderBy: { bookings: { _count: "desc" } },
      take: 5,
    }),
  ]);

  const occupiedRooms = roomsByStatus.find((r) => r.status === RoomStatus.OCCUPIED)?._count._all ?? 0;

  return {
    window: { days: 30, since: since.toISOString() },
    listings: {
      properties: propertyCount,
      rooms: roomCount,
      byRoomStatus: toBuckets(roomsByStatus as never[], "status"),
      occupancyRate: roomCount ? Number((occupiedRooms / roomCount).toFixed(4)) : 0,
      availableRooms: roomsByStatus.find((r) => r.status === RoomStatus.AVAILABLE)?._count._all ?? 0,
    },
    bookings: {
      pending: pendingBookings,
      newInWindow: bookingsInWindow,
      byStatus: toBuckets(bookingsByStatus as never[], "status"),
    },
    earnings: {
      gross: revenueAgg._sum.amount ?? 0,
      platformFee: feeAgg._sum.platformFee ?? 0,
    },
    recentBookings,
    topRooms: topRooms.map((r) => ({ ...r, bookings: r._count.bookings })),
  };
}

export const nonAdminUserWhere = { ...softActive, role: { not: Role.ADMIN } };