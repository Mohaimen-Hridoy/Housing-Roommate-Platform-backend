import { Role, PropertyStatus, RoomStatus, BookingStatus, PaymentStatus, PaymentProvider } from "@prisma/client";
import { prisma } from "./utils/prisma";
import { hashPassword } from "./utils/security";
import { logger } from "./utils/logger";

async function upsertUser(data: { email: string; name: string; role: Role; password: string; isVerified?: boolean }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  const passwordHash = await hashPassword(data.password);
  if (existing) {
    return prisma.user.update({ where: { email: data.email }, data: { name: data.name, role: data.role, passwordHash, isVerified: data.isVerified ?? true } });
  }
  return prisma.user.create({ data: { email: data.email, name: data.name, role: data.role, passwordHash, isVerified: data.isVerified ?? true } });
}

export async function seed(): Promise<void> {
  logger.info("Seeding database...");

  const owner = await upsertUser({ email: "owner@housing.local", name: "Owner User", role: Role.OWNER, password: "Owner1234!" });
  const tenant = await upsertUser({ email: "tenant@housing.local", name: "Tenant User", role: Role.TENANT, password: "Tenant1234!" });
  await upsertUser({ email: "admin@housing.local", name: "Admin User", role: Role.ADMIN, password: "Admin1234!" });

  await prisma.amenity.deleteMany({});
  await prisma.amenity.createMany({
    data: [
      { name: "Wifi", icon: "wifi" },
      { name: "Kitchen", icon: "kitchen" },
      { name: "Washing Machine", icon: "wash" },
      { name: "Parking", icon: "parking" },
      { name: "Air Conditioning", icon: "ac" },
    ],
  });

  const amenities = await prisma.amenity.findMany({ select: { id: true, name: true } });

  const property = await prisma.property.upsert({
    where: { id: "seed-property-1" },
    update: { title: "Downtown Loft", status: PropertyStatus.PUBLISHED, publishedAt: new Date() },
    create: {
      id: "seed-property-1",
      owner: { connect: { id: owner.id } },
      title: "Downtown Loft",
      description: "A modern loft in the city center.",
      address: "123 Main St",
      city: "Metropolis",
      state: "NY",
      postalCode: "10001",
      country: "US",
      status: PropertyStatus.PUBLISHED,
      publishedAt: new Date(),
      amenities: { connect: amenities.map((a) => ({ id: a.id })) },
    },
  });

  await prisma.room.upsert({
    where: { id: "seed-room-1" },
    update: { rent: 1200, status: RoomStatus.AVAILABLE },
    create: {
      id: "seed-room-1",
      property: { connect: { id: property.id } },
      title: "Cozy Bedroom",
      description: "Bright, quiet room with a private bath.",
      area: 24,
      rent: 1200,
      currency: "usd",
      deposit: 600,
      bedrooms: 1,
      bathrooms: 1,
      facing: "EAST",
      availableFrom: new Date(),
      status: RoomStatus.AVAILABLE,
    },
  });

  const roomId = "seed-room-1";
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { rent: true, currency: true, id: true, property: { select: { id: true } } } });
  if (room) {
    const nights = 30;
    const total = room.rent * nights;
    await prisma.booking.upsert({
      where: { id: "seed-booking-1" },
      update: {},
      create: {
        id: "seed-booking-1",
        tenant: { connect: { id: tenant.id } },
        room: { connect: { id: room.id } },
        property: { connect: { id: room.property.id } },
        status: BookingStatus.APPROVED,
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + (24 + nights) * 60 * 60 * 1000),
        nightlyRate: room.rent,
        currency: room.currency,
        totalAmount: total,
        platformFee: Math.round((total * 5) / 100),
      },
    });

    const booking = await prisma.booking.findUnique({ where: { id: "seed-booking-1" }, select: { id: true, tenantId: true } });
    if (booking) {
      await prisma.payment.upsert({
        where: { id: "seed-payment-1" },
        update: {},
        create: {
          id: "seed-payment-1",
          booking: { connect: { id: booking.id } },
          tenant: { connect: { id: tenant.id } },
          provider: PaymentProvider.MOCK,
          amount: total,
          currency: room.currency,
          status: PaymentStatus.SUCCEEDED,
          providerPaymentId: "mock_seed_payment",
        },
      });
    }
  }

  await prisma.favorite.create({ data: { userId: tenant.id, propertyId: "seed-property-1" } });

  await prisma.review.create({
    data: {
      subject: "ROOM",
      reviewableId: "seed-room-1",
      author: { connect: { id: tenant.id } },
      booking: { connect: { id: "seed-booking-1" } },
      rating: 5,
      comment: "Great place!",
    },
  });

  logger.info(`Seed complete. users=${await prisma.user.count()} properties=${await prisma.property.count()} rooms=${await prisma.room.count()}`);
}

if (require.main === module) {
  seed()
    .catch((err) => {
      logger.error("Seed failed", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
